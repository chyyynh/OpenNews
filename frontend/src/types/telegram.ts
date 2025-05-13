/**
 * Represents the user data object received from Telegram after successful login via the widget,
 * typically through the onTelegramAuth callback or redirect.
 */
export interface TelegramUserAuth {
  id: number; // Unique identifier for the user
  first_name: string; // User's first name
  last_name?: string; // Optional: User's last name
  username?: string; // Optional: User's username
  photo_url?: string; // Optional: URL of the user's profile photo
  auth_date: number; // Unix timestamp: date when the authentication data was signed
  hash: string; // A hash string to verify the authenticity of the data
}
