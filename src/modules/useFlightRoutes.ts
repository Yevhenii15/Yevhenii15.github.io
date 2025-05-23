import { ref } from "vue";
import { makeRequest } from "./functions/makeRequest";
import { useUsers } from "./auth/useUsers";
import { useFlights } from "./useFlights";
import type { flightRoute, NewFlightRoute } from "../interfaces/interfaces";

const { flights, fetchFlights } = useFlights();
const { getTokenAndUserId } = useUsers();

export const useFlightRoutes = () => {
  const error = ref<string | null>(null);
  const loading = ref<boolean>(false);
  const routes = ref<flightRoute[]>([]);

  const fetchRoutes = async (): Promise<void> => {
    loading.value = true;
    try {
      const data: flightRoute[] = await makeRequest("/routes", "GET");
      routes.value.splice(0, routes.value.length, ...data);
      // console.log("Routes fetched", routes.value);
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      loading.value = false;
    }
  };

  const addRoute = async (route: NewFlightRoute): Promise<void> => {
    try {
      const { token, isAdmin } = getTokenAndUserId();
      if (!isAdmin) throw new Error("Access Denied: Admins only");

      const newRoute: flightRoute = await makeRequest(
        "/routes",
        "POST",
        route,
        true
      );
      routes.value.push(newRoute);
      // console.log("New route added", newRoute);
      alert("Route added successfully!");

      await fetchRoutes();
    } catch (err) {
      console.error("Error in addRoute:", (err as Error).message);
      error.value = (err as Error).message || "Failed to add route";
    }
  };

  const deleteRoute = async (_id: string): Promise<void> => {
    try {
      if (!_id) {
        console.error("❌ ERROR: Missing route ID! Cannot delete.");
        return;
      }

      const { token, isAdmin } = getTokenAndUserId();
      if (!isAdmin) throw new Error("Access Denied: Admins only");

      if (flights.value.length === 0) {
        await fetchFlights();
      }

      const usedInFlights = flights.value.some(
        (flight) => flight.route?._id === _id
      );

      if (usedInFlights) {
        alert("❌ Cannot delete route: It is used in one or more flights.");
        return;
      }

      await makeRequest(`/routes/${_id}`, "DELETE", undefined, true);

      routes.value = routes.value.filter((route) => route._id !== _id);
      // console.log("✅ Route deleted:", _id);
      alert("Route deleted successfully");
    } catch (err) {
      console.error("❌ Error in deleteRoute:", err);
      alert("Failed to delete route");
      error.value = (err as Error).message;
    }
  };

  const updateRoute = async (
    id: string,
    updatedRoute: Partial<flightRoute>
  ): Promise<void> => {
    try {
      const { token, isAdmin } = getTokenAndUserId();
      if (!isAdmin) throw new Error("Access Denied: Admins only");

      const updatedData: flightRoute = await makeRequest(
        `/routes/${id}`,
        "PUT",
        updatedRoute,
        true
      );

      const index = routes.value.findIndex((route) => route._id === id);
      if (index !== -1) {
        routes.value[index] = {
          ...updatedData,
          _id: id,
        };
      }

      // console.log("Route updated", routes.value[index]);
      alert("Route updated successfully!");
    } catch (err) {
      error.value = (err as Error).message;
    }
  };

  return {
    error,
    loading,
    routes,
    fetchRoutes,
    addRoute,
    deleteRoute,
    updateRoute,
  };
};
