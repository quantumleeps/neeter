import type { PermissionRequest, PermissionResponse } from "../types.js";

interface PendingRequest {
  request: PermissionRequest;
  resolve: (response: PermissionResponse) => void;
}

type RequestListener = (request: PermissionRequest) => void;

export class PermissionGate {
  private pending = new Map<string, PendingRequest>();
  private listeners = new Set<RequestListener>();

  request(permissionRequest: PermissionRequest): Promise<PermissionResponse> {
    return new Promise<PermissionResponse>((resolve) => {
      this.pending.set(permissionRequest.requestId, {
        request: permissionRequest,
        resolve,
      });
      for (const listener of this.listeners) {
        listener(permissionRequest);
      }
    });
  }

  respond(response: PermissionResponse): boolean {
    const entry = this.pending.get(response.requestId);
    if (!entry) return false;
    this.pending.delete(response.requestId);
    entry.resolve(response);
    return true;
  }

  onRequest(listener: RequestListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getPending(): PermissionRequest[] {
    return [...this.pending.values()].map((p) => p.request);
  }

  cancelAll(message: string) {
    for (const [id, entry] of this.pending) {
      if (entry.request.kind === "tool_approval") {
        entry.resolve({ kind: "tool_approval", requestId: id, behavior: "deny", message });
      } else {
        entry.resolve({ kind: "user_question", requestId: id, answers: {} });
      }
    }
    this.pending.clear();
  }
}
