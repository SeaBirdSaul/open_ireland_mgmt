/**
 * Service function to fetch grouped bookings for a user.
 * Interacts with the API to retrieve bookings organized by groups.
 */
import { API_BASE_URL } from '../config/api';

export async function fetchGroupedBookings() {
  const response = await fetch(`${API_BASE_URL}/bookings/my?grouped=true`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to load bookings: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

