<template>
  <div class="p-6">
    <router-link
      to="/admin"
      class="inline-block mb-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
    >
      🔙 Back to Admin
    </router-link>
  </div>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-6">📋 Admin – All Bookings</h1>

    <!-- Search Section -->
    <div class="mb-6 flex items-center gap-2">
      <input
        v-model="searchTerm"
        type="text"
        placeholder="Search by User Email or Booking ID"
        class="flex-1 text-black p-2 border rounded-md"
      />
      <button
        @click="search"
        class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
      >
        Search
      </button>
      <button
        @click="reset"
        class="bg-gray-300 hover:bg-gray-400 text-black px-4 py-2 rounded-md"
      >
        Reset
      </button>
    </div>

    <div v-if="searchError" class="text-red-600 mb-4">{{ searchError }}</div>

    <div v-if="bookingLoading" class="text-blue-500 mb-4">Loading...</div>
    <div v-if="bookingError" class="text-red-600 mb-4">{{ bookingError }}</div>

    <!-- Booking Cards Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="booking in bookings"
        :key="booking._id"
        class="bg-black text-white border border-[#ff7f50] shadow-lg rounded-xl p-6 flex flex-col"
      >
        <!-- 1. Header -->
        <BookingHeader
          :booking="booking"
          :showId="true"
          :showCancelButton="true"
          @cancel="handleCancel"
        />

        <!-- 2. Info -->
        <BookingInfo :booking="booking" :formatDate="formatDate" />

        <!-- 3. Flight Details Section -->
        <div v-if="flightLoading" class="text-blue-500 mb-4">
          Loading flight details...
        </div>
        <div v-if="flightError" class="text-red-600 mb-4">
          {{ flightError }}
        </div>

        <FlightDetails
          v-else
          :ticket="booking.tickets[0]"
          :flight="flightsById[booking.tickets[0].flight_id]"
          :formatDate="formatDate"
        />

        <!-- 4. Ticket List -->
        <TicketList :tickets="booking.tickets" />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useBookings } from "../../modules/useBookings";
import { useFlights } from "../../modules/useFlights";
import type { Booking } from "@/interfaces/interfaces";
import { formatDate } from "../../modules/functions/dateFormater";

// Reusable components
import BookingHeader from "@/components/booking/details/BookingHeader.vue";
import BookingInfo from "@/components/booking/details/BookingInfo.vue";
import FlightDetails from "@/components/booking/details/FlightDetails.vue";
import TicketList from "@/components/booking/details/TicketList.vue";

const {
  bookings,
  error: bookingError,
  loading: bookingLoading,
  fetchAllBookings,
  cancelBooking,
  fetchBookingsByEmail,
  fetchBookingById,
} = useBookings();

const {
  fetchFlightById,
  error: flightError,
  loading: flightLoading,
} = useFlights();

const flightsById = ref<Record<string, any>>({});
const searchTerm = ref<string>("");
const searchError = ref<string>("");

onMounted(async () => {
  await loadAll();
});

async function loadAll() {
  await fetchAllBookings();
  await loadFlightsFor(bookings.value);
}

// Helper to load flight details for a list
async function loadFlightsFor(list: Booking[]) {
  const ids = [
    ...new Set(list.flatMap((b) => b.tickets.map((t) => t.flight_id))),
  ];
  for (const id of ids) {
    if (!flightsById.value[id]) {
      try {
        const flight = await fetchFlightById(id);
        if (flight) {
          flightsById.value[id] = flight;
        } else {
          flightsById.value[id] = null;
        }
      } catch {
        flightsById.value[id] = null;
      }
    }
  }
}

// Search by email or ID
async function search() {
  if (!searchTerm.value.trim()) {
    searchError.value = "Please enter an email or booking ID.";
    return;
  }
  searchError.value = "";

  if (searchTerm.value.includes("@")) {
    // Email search
    try {
      await fetchBookingsByEmail(searchTerm.value);
      if (bookings.value.length === 0) {
        searchError.value = "No bookings found with that email.";
      } else {
        await loadFlightsFor(bookings.value);
      }
    } catch (err) {
      searchError.value = (err as Error).message;
    }
  } else {
    // Booking ID search
    try {
      const single = await fetchBookingById(searchTerm.value);
      bookings.value = [single];
      await loadFlightsFor(bookings.value);
    } catch {
      searchError.value = "No booking found with that ID.";
    }
  }
}

// Reset to full list
async function reset() {
  searchTerm.value = "";
  searchError.value = "";
  flightsById.value = {};
  await loadAll();
}

// Handle cancel
async function handleCancel(id: string) {
  if (confirm("Are you sure you want to cancel this booking?")) {
    await cancelBooking(id);
  }
}
</script>
