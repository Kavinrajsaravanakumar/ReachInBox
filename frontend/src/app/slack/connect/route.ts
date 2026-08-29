import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const token = cookies().get("rib_token")?.value;
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  if (!token) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const res = await fetch(`${api}/api/slack/oauth/authorize`, {
    headers: { Authorization: `Bearer ${decodeURIComponent(token)}` },
    redirect: "manual",
  });

  const location = res.headers.get("location");
  if (location) {
    return NextResponse.redirect(location);
  }

  const body = await res.text();
  let message = "Slack OAuth is not configured on the API.";
  try {
    const json = JSON.parse(body) as { error?: string };
    if (json.error) message = json.error;
  } catch {
    /* keep default */
  }

  return NextResponse.redirect(`${origin}/dashboard?slack_error=${encodeURIComponent(message)}`);
}
