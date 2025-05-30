<template>
  <Suspense>
    <template #default>
      <div class="p-4 max-w-4xl mx-auto">
        <h1 class="text-2xl font-bold mb-4">Flight Check-In</h1>

        <div v-if="bookings.length === 0 && !loading">No bookings found.</div>
        <div v-if="loading">Loading bookings...</div>

        <div v-if="selectedBooking">
          <h2 class="text-xl font-semibold mb-2">
            Booking ID: {{ selectedBooking._id }}
          </h2>

          <form @submit.prevent="submitCheckIn">
            <div
              v-for="(ticket, index) in selectedBooking.tickets"
              :key="
                ticket.ticket_id ||
                `temp-${ticket.firstName}-${ticket.lastName}`
              "
              class="mb-6 border p-4 rounded-lg shadow"
            >
              <h3 class="font-semibold mb-2">
                Passenger {{ index + 1 }}: {{ ticket.firstName }}
                {{ ticket.lastName }}
              </h3>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-black">
                <input
                  v-model="checkInData[getTicketId(ticket)].passportNumber"
                  type="text"
                  placeholder="Passport Number"
                  class="input"
                  required
                />
                <input
                  v-model="checkInData[getTicketId(ticket)].nationality"
                  type="text"
                  placeholder="Nationality"
                  class="input"
                  required
                />
                <span class="text-white">Date of Birth:</span>
                <span class="text-white">Expiration Date:</span>

                <input
                  v-model="checkInData[getTicketId(ticket)].dateOfBirth"
                  type="date"
                  class="input"
                  required
                  :min="minBirthdate"
                  @change="
                    () =>
                      validateBirthdate(
                        ticket,
                        checkInData,
                        errors,
                        getTicketId
                      )
                  "
                />
                <input
                  v-model="checkInData[getTicketId(ticket)].expirationDate"
                  type="date"
                  class="input"
                  required
                  :min="minExpirationDate(ticket)"
                  @change="
                    () =>
                      validateExpirationDate(
                        ticket,
                        checkInData,
                        errors,
                        getTicketId
                      )
                  "
                />
              </div>

              <div
                v-if="errors[getTicketId(ticket)]?.expirationDate"
                class="text-red-600 mt-2"
              >
                {{ errors[getTicketId(ticket)].expirationDate }}
              </div>
              <div
                v-if="errors[getTicketId(ticket)]?.dateOfBirth"
                class="text-red-600 mt-2"
              >
                {{ errors[getTicketId(ticket)].dateOfBirth }}
              </div>
            </div>

            <button
              type="submit"
              class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              :disabled="submitting"
            >
              {{ submitting ? "Checking in..." : "Check In All Passengers" }}
            </button>
          </form>

          <div v-if="success" class="text-green-600 mt-4 font-semibold">
            All passengers checked in successfully!
          </div>

          <!-- Display the checked-in ticket details -->
          <div v-if="checkedInTickets.length" class="mt-6">
            <h2 class="text-xl font-semibold mb-2 text-white">
              Checked-In Tickets
            </h2>
            <div class="flex flex-wrap gap-4">
              <TicketDisplay
                v-for="ticket in checkedInTickets"
                :key="ticket._id"
                :ticket="ticket"
              />
            </div>
          </div>
        </div>

        <div v-if="!selectedBooking && bookings.length">
          <BookingSelect
            :availableBookings="availableBookings"
            :selectedBookingId="selectedBookingId"
            @update:selectedBookingId="selectedBookingId = $event"
            @selectBooking="selectBooking"
          />
        </div>
      </div>
    </template>
    <template #fallback>
      <div>Loading...</div>
    </template>
  </Suspense>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, reactive } from "vue";
import { useBookings } from "../modules/useBookings";
import { useCheckIn } from "../modules/useCheckIn";
import { useAirports } from "../modules/useAirports";
import type { Booking } from "../interfaces/interfaces";
import BookingSelect from "../components/checkIn/BookingSelect.vue";
import TicketDisplay from "../components/ticket/TicketDisplay.vue";
import { useFlights } from "../modules/useFlights";
import QRCode from "qrcode";

const { fetchAirports } = useAirports();
const { bookings, loading, fetchUserBookings } = useBookings();
const {
  checkIn,
  saveTicket,
  generateTicketData,
  getTicketId,
  minBirthdate,
  minExpirationDate,
  validateExpirationDate,
  validateBirthdate,
} = useCheckIn();
const { fetchFlightById } = useFlights();

onMounted(() => {
  fetchAirports();
});

const selectedBookingId = ref<string>("");
const selectedBooking = ref<Booking | null>(null);
const checkedInTickets = ref<any[]>([]);
const checkInData = reactive<
  Record<
    string,
    {
      passportNumber: string;
      nationality: string;
      dateOfBirth: string;
      expirationDate: string;
    }
  >
>({});
const errors = reactive<
  Record<string, { expirationDate?: string; dateOfBirth?: string }>
>({});
const submitting = ref(false);
const success = ref(false);

onMounted(async () => {
  await fetchUserBookings();
});

const selectBooking = () => {
  const booking = bookings.value.find((b) => b._id === selectedBookingId.value);
  if (booking) {
    selectedBooking.value = booking;
    for (const ticket of booking.tickets) {
      const ticketId = getTicketId(ticket);
      checkInData[ticketId] = {
        passportNumber: "",
        nationality: "",
        dateOfBirth: "",
        expirationDate: "",
      };
    }
  }
};

const getValidTickets = () => {
  if (!selectedBooking.value) return [];
  return selectedBooking.value.tickets.filter((ticket) => ticket._id);
};

const fetchFlightDataForTickets = async (tickets: any[]) => {
  return await Promise.all(
    tickets.map(async (ticket) => {
      const ticketId = getTicketId(ticket);
      const passengerData = checkInData[ticketId];
      const flight = await fetchFlightById(ticket.flight_id);
      return { ticket, ticketId, passengerData, flight };
    })
  );
};

const processTicketCheckIn = async (
  ticket: any,
  ticketId: string,
  passengerData: any,
  flight: any
) => {
  if (!ticketId || !passengerData || !flight) return;

  await checkIn(ticketId, passengerData);

  const qrPayload = {
    name: `${ticket.firstName} ${ticket.lastName}`,
    flight: flight.flightNumber,
    passport: passengerData.passportNumber,
    dateOfBirth: passengerData.dateOfBirth,
    nationality: passengerData.nationality,
    expirationDate: passengerData.expirationDate,
  };

  const qrDataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload));

  const ticketData = {
    ...generateTicketData(ticket, passengerData, qrDataUrl, flight),
    ...passengerData,
    isCheckedIn: true,
    departureDate: ticket.departureDate,
    checkInTime: new Date().toISOString(),
  };

  if (ticket._id) {
    await saveTicket(
      ticketData,
      passengerData.expirationDate || "",
      ticket._id
    );
    checkedInTickets.value.push(ticketData);
  }
};
const submitCheckIn = async () => {
  if (!selectedBooking.value) return;

  submitting.value = true;
  success.value = false;

  try {
    const validTickets = getValidTickets();
    const ticketFlightPairs = await fetchFlightDataForTickets(validTickets);

    for (const {
      ticket,
      ticketId,
      passengerData,
      flight,
    } of ticketFlightPairs) {
      await processTicketCheckIn(ticket, ticketId, passengerData, flight);
    }

    success.value = true;
  } catch (err) {
    console.error("❌ Check-in error:", err);
  } finally {
    submitting.value = false;
  }
};

const availableBookings = computed(() =>
  bookings.value.filter(
    (booking) =>
      booking.tickets.every(
        (ticket) =>
          ticket.isCheckedIn !== true &&
          new Date(ticket.departureDate) > new Date()
      ) &&
      new Date(booking.tickets[0].departureDate) > new Date() &&
      booking.bookingStatus !== "Cancelled"
  )
);
</script>

<style scoped>
.input {
  @apply border p-2 rounded w-full;
}
</style>
