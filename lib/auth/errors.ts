export function mapAuthError(message: string): string {
  if (/already registered|already exists|already been registered/i.test(message)) {
    return "That email cannot be used.";
  }
  if (/rate limit|too many/i.test(message)) {
    return "Too many requests. Please wait a moment and try again.";
  }
  if (/expired|invalid/i.test(message)) {
    return "That code is invalid or expired. Request a new code and try again.";
  }
  return message;
}
