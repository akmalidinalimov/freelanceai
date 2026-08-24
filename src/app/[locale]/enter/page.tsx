import { LaunchTicketEntry } from "@/components/launch-ticket-entry";

/**
 * Landing page for a bot-issued Mini App launch. Spends the single-use ticket in the URL and
 * forwards the user where they were going. Renders a spinner, never login options — if the ticket
 * is bad it hands off to /login rather than leaving the user on a dead screen.
 */
export default function EnterPage() {
  return <LaunchTicketEntry />;
}
