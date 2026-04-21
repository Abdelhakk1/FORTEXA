import "server-only";

import { Inngest } from "inngest";
import { serverEnv } from "@/lib/env/server";

export const inngest = new Inngest({
  id: serverEnv.inngestAppId,
  eventKey: serverEnv.inngestEventKey,
});
