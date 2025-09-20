// lib/gcp-clients.js
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { Storage } from "@google-cloud/storage";

let visionClient;
let storage;

// This function ensures clients are only created once
export function getGcpClients() {
  if (!visionClient || !storage) {
    const credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY);
    visionClient = new ImageAnnotatorClient({ credentials });
    storage = new Storage({ credentials });
  }
  return { visionClient, storage };
}