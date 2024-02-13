// Add import statements for the lock-related functions
import { ResponseObject, ResponseToolkit, ServerRoute } from "@hapi/hapi";

/**
 * Endpoint to acquire a lock.
 *
 * @param request
 * @param h
 * @param d
 * @returns
 */
async function acquireResourceLock(
  request: Request,
  h: ResponseToolkit,
  d: any
): Promise<ResponseObject> {
  try {
    // Call the acquireLock function to acquire the lock
    await acquireLock(request.payload.resourceId);

    // Return a success response
    return h.response("Lock acquired successfully").code(200);
  } catch (error) {
    // Handle errors
    console.error("Error acquiring lock:", error);
    return h.response("Failed to acquire lock").code(500);
  }
}

/**
 * Endpoint to release a lock.
 *
 * @param request
 * @param h
 * @param d
 * @returns
 */
async function releaseResourceLock(
  request: Request,
  h: ResponseToolkit,
  d: any
): Promise<ResponseObject> {
  try {
    // Call the releaseLock function to release the lock
    await releaseLock(request.payload.resourceId);

    // Return a success response
    return h.response("Lock released successfully").code(200);
  } catch (error) {
    // Handle errors
    console.error("Error releasing lock:", error);
    return h.response("Failed to release lock").code(500);
  }
}

export const lockRoutes: ServerRoute[] = [
  // Endpoint to acquire a lock
  { method: "POST", path: "/api/lock/acquire", handler: acquireResourceLock },
  // Endpoint to release a lock
  { method: "POST", path: "/api/lock/release", handler: releaseResourceLock },
];
