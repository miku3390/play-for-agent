const BASE = "/api/v1";

export async function health(): Promise<unknown> {
  const res = await fetch(`${BASE.replace("/api/v1", "")}/health`);
  return res.json();
}
