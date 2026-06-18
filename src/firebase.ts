import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export function useFirestoreBackend(): boolean {
  return process.env.SHIPTEC_DATA_BACKEND === "firestore"
    || Boolean(process.env.FUNCTION_TARGET)
    || Boolean(process.env.K_SERVICE);
}

export function firestore() {
  if (!getApps().length) {
    initializeApp();
  }
  return getFirestore();
}
