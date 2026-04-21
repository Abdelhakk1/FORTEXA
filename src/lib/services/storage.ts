import "server-only";

import { Buffer } from "node:buffer";
import * as Sentry from "@sentry/nextjs";
import { serverEnv } from "@/lib/env/server";
import { err, ok, type ActionResult } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface StorageUploadResult {
  bucket: string;
  path: string;
  fileName: string;
  size: number;
}

export async function uploadFileToStorage(params: {
  bucket: string;
  path: string;
  file: File;
}): Promise<ActionResult<StorageUploadResult>> {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    return err(
      "service_unavailable",
      "SUPABASE_SERVICE_ROLE_KEY is missing. Storage uploads are currently disabled."
    );
  }

  try {
    const buffer = Buffer.from(await params.file.arrayBuffer());
    const { error } = await admin.storage.from(params.bucket).upload(
      params.path,
      buffer,
      {
        contentType: params.file.type || "application/octet-stream",
        upsert: false,
      }
    );

    if (error) {
      return err("server_error", error.message);
    }

    return ok({
      bucket: params.bucket,
      path: params.path,
      fileName: params.file.name,
      size: params.file.size,
    });
  } catch (error) {
    Sentry.captureException(error);
    return err(
      "server_error",
      "We could not upload the file to Supabase Storage."
    );
  }
}

export function getFortexaStorageBuckets() {
  return {
    reports: serverEnv.fortexaReportsBucket,
    scanImports: serverEnv.fortexaScanImportsBucket,
  };
}
