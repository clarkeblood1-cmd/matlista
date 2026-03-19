const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const vision = require("@google-cloud/vision");

const client = new vision.ImageAnnotatorClient();

exports.detectProductName = onCall(
  { region: "europe-west1", timeoutSeconds: 60, memory: "512MiB" },
  async (request) => {
    const auth = request.auth;
    const imageBase64 = request.data?.imageBase64;

    if (!auth) {
      throw new HttpsError("unauthenticated", "Du måste vara inloggad.");
    }

    if (!imageBase64 || typeof imageBase64 !== "string") {
      throw new HttpsError("invalid-argument", "Ingen bild skickades med.");
    }

    try {
      const [labelResult] = await client.labelDetection({
        image: { content: imageBase64 },
      });

      const [textResult] = await client.textDetection({
        image: { content: imageBase64 },
      });

      const labels = (labelResult.labelAnnotations || []).map((l) => l.description);
      const texts = (textResult.textAnnotations || []).map((t) => t.description);

      const joinedText = texts.join(" ").toLowerCase();
      const joinedLabels = labels.join(" ").toLowerCase();

      let suggestion = "Ny vara";
      let category = "MAT";
      let place = "kyl";
      let unit = "st";

      if (joinedText.includes("mjölk") || joinedLabels.includes("milk")) {
        suggestion = "Mjölk";
        category = "MAT";
        place = "kyl";
        unit = "l";
      } else if (
        joinedText.includes("havre") ||
        joinedText.includes("oat") ||
        joinedText.includes("oddlygood")
      ) {
        suggestion = "Havredryck";
        category = "MAT";
        place = "kyl";
        unit = "l";
      } else if (joinedText.includes("cola") || joinedLabels.includes("soft drink")) {
        suggestion = "Cola";
        category = "GODIS";
        place = "kyl";
        unit = "st";
      } else if (joinedText.includes("pasta") || joinedLabels.includes("pasta")) {
        suggestion = "Pasta";
        category = "MAT";
        place = "köksskåp";
        unit = "pkt";
      } else if (
        joinedText.includes("salt") ||
        joinedText.includes("paprika") ||
        joinedText.includes("krydda")
      ) {
        suggestion = "Krydda";
        category = "KRYDDOR";
        place = "kryddor";
        unit = "g";
      } else if (texts.length > 0) {
        suggestion = texts[0].split("\n")[0].trim().slice(0, 40) || "Ny vara";
      } else if (labels.length > 0) {
        suggestion = labels[0];
      }

      return {
        suggestion,
        category,
        place,
        unit,
        labels,
        texts,
      };
    } catch (error) {
      logger.error("Vision error", error);
      throw new HttpsError("internal", "AI-igenkänning misslyckades.");
    }
  }
);
