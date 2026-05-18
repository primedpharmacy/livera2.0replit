/**
 * Object storage service for the web artifact.
 *
 * Thin wrapper around @google-cloud/storage that talks to the Replit sidecar
 * for credentials + presigned URL signing. Adapted from the
 * `.local/skills/object-storage` skill template (which targets Express) for
 * use inside Next.js route handlers.
 *
 * Storage of patient-uploaded prescriptions (Task 82):
 *   - presigned PUT URL → browser uploads directly to GCS
 *   - we store only the normalized object path (`/objects/<id>`) on the order
 *   - ACL policy stored as custom metadata, scoped by `clinic_id`
 *   - reads gated by `canAccessObject` (clinic-staff-in-same-clinic)
 */

import { Storage, type File } from '@google-cloud/storage';
import { randomUUID } from 'crypto';

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';
const ACL_POLICY_METADATA_KEY = 'custom:aclPolicy';

export const objectStorageClient = new Storage({
  credentials: {
    audience: 'replit',
    subject_token_type: 'access_token',
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: 'external_account',
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: 'json', subject_token_field_name: 'access_token' },
    },
    universe_domain: 'googleapis.com',
  },
  projectId: '',
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super('Object not found');
    this.name = 'ObjectNotFoundError';
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export interface ObjectAclPolicy {
  // Identifier for the clinic that owns this object (e.g. 'feeltru', 'vsc').
  // Only staff with active_clinic_id === clinic_id can READ.
  clinic_id: string;
  // For audit — the order this upload belongs to.
  order_id?: string;
  // Restrict reads to a specific set of staff roles (clinical staff only).
  allowed_roles?: string[];
  visibility: 'private';
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith('/')) path = `/${path}`;
  const parts = path.split('/');
  if (parts.length < 3) throw new Error('Invalid path: must contain at least a bucket name');
  return { bucketName: parts[1], objectName: parts.slice(2).join('/') };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: 'GET' | 'PUT' | 'DELETE' | 'HEAD';
  ttlSec: number;
}): Promise<string> {
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bucket_name: bucketName,
        object_name: objectName,
        method,
        expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL (${response.status}); is the Replit sidecar reachable?`,
    );
  }
  const { signed_url } = (await response.json()) as { signed_url: string };
  return signed_url;
}

export class ObjectStorageService {
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || '';
    if (!dir) {
      throw new Error(
        'PRIVATE_OBJECT_DIR not set. Provision object storage via setupObjectStorage().',
      );
    }
    return dir;
  }

  /**
   * Generate a presigned PUT URL for a new object under the private dir.
   * Returns both the upload URL (for the browser) and the normalized
   * `/objects/<id>` path that should be stored on the domain entity.
   */
  async createUploadUrl(): Promise<{ uploadURL: string; objectPath: string }> {
    const privateDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const fullPath = `${privateDir.replace(/\/$/, '')}/uploads/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const uploadURL = await signObjectURL({
      bucketName,
      objectName,
      method: 'PUT',
      ttlSec: 900,
    });
    return { uploadURL, objectPath: `/objects/uploads/${objectId}` };
  }

  /** Resolve `/objects/<id>` → GCS `File` handle. Throws if the file is missing. */
  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith('/objects/')) throw new ObjectNotFoundError();
    const parts = objectPath.slice(1).split('/'); // ['objects', '<id...>']
    if (parts.length < 2) throw new ObjectNotFoundError();
    const entityId = parts.slice(1).join('/');
    const dir = this.getPrivateObjectDir().replace(/\/$/, '');
    const { bucketName, objectName } = parseObjectPath(`${dir}/${entityId}`);
    const file = objectStorageClient.bucket(bucketName).file(objectName);
    const [exists] = await file.exists();
    if (!exists) throw new ObjectNotFoundError();
    return file;
  }

  async setAclPolicy(objectPath: string, policy: ObjectAclPolicy): Promise<void> {
    const file = await this.getObjectEntityFile(objectPath);
    await file.setMetadata({
      metadata: { [ACL_POLICY_METADATA_KEY]: JSON.stringify(policy) },
    });
  }

  async getAclPolicy(file: File): Promise<ObjectAclPolicy | null> {
    const [metadata] = await file.getMetadata();
    const raw = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
    if (!raw) return null;
    try {
      return JSON.parse(raw as string) as ObjectAclPolicy;
    } catch {
      return null;
    }
  }

  /**
   * Stream a GCS file out as a `Response`. Caller is responsible for ACL.
   */
  async streamObject(file: File, cacheTtlSec = 3600): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const nodeStream = file.createReadStream();
    // Node's Readable is web-compatible enough for Response in Next.js.
    const webStream = new ReadableStream<Uint8Array>({
      start(controller) {
        nodeStream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
        nodeStream.on('end', () => controller.close());
        nodeStream.on('error', (err) => controller.error(err));
      },
      cancel() {
        nodeStream.destroy();
      },
    });
    const headers: Record<string, string> = {
      'Content-Type': (metadata.contentType as string) || 'application/octet-stream',
      'Cache-Control': `private, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) headers['Content-Length'] = String(metadata.size);
    return new Response(webStream, { headers });
  }
}

export const objectStorageService = new ObjectStorageService();

/**
 * Server-side upload — used by the tokenised email-link upload route, which
 * accepts a multipart file from a patient page and persists it on their
 * behalf (the patient page is a stateless URL, so a presigned-PUT round-trip
 * adds no value there). Writes the bytes into the private dir under a new
 * UUID and returns the canonical /objects/<entity_id> path so the caller
 * can attach the policy + record on the order.
 */
export async function serverSideUpload(input: {
  bytes: Buffer;
  contentType: string;
}): Promise<{ object_path: string }> {
  const privateObjectDir = objectStorageService.getPrivateObjectDir();
  const objectId = randomUUID();
  const fullPath = `${privateObjectDir}/uploads/${objectId}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);
  await file.save(input.bytes, {
    contentType: input.contentType,
    resumable: false,
  });
  return { object_path: `/objects/uploads/${objectId}` };
}

/**
 * ACL check for private object reads. Two gates:
 *   1. Same-clinic — the caller's active clinic must match the object's
 *      clinic_id. No cross-clinic share for patient evidence.
 *   2. Role allow-list — if the policy declares `allowed_roles`, the caller
 *      must have at least one of those roles. Used to keep non-clinical
 *      staff (e.g. Coach) away from prescription files.
 */
export function canStaffAccessObject(
  policy: ObjectAclPolicy | null,
  staff: { active_clinic_id: string; roles: string[] },
): boolean {
  if (!policy) return false;
  if (policy.clinic_id !== staff.active_clinic_id) return false;
  if (policy.allowed_roles && policy.allowed_roles.length > 0) {
    if (!staff.roles.some((r) => policy.allowed_roles!.includes(r))) return false;
  }
  return true;
}

/**
 * Read the object's stored content-type and byte size from GCS. Used by the
 * finalize endpoint to re-validate what was actually uploaded, instead of
 * trusting the metadata the client posted alongside `object_path`.
 */
export async function getObjectStoredMetadata(
  objectPath: string,
): Promise<{ contentType: string; size: number }> {
  const file = await objectStorageService.getObjectEntityFile(objectPath);
  const [metadata] = await file.getMetadata();
  const contentType = (metadata.contentType as string) || 'application/octet-stream';
  const sizeRaw = metadata.size;
  const size = typeof sizeRaw === 'string' ? Number(sizeRaw) : Number(sizeRaw ?? 0);
  return { contentType, size };
}
