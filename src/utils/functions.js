import { decodeTxRaw } from "@cosmjs/proto-signing";
import { fromBase64 } from "@cosmjs/encoding";

const decodeEthereumTx = (msg) => {
  try {
    const parsed = typeof msg === "string" ? JSON.parse(msg) : msg;
    const functionName = Object.keys(parsed)[0];
    const payload = parsed[functionName];

    return {
      functionName,
      payload,
    };
  } catch (e) {
    return {
      functionName: "unknown",
      payload: {},
      from: undefined,
      to: undefined,
    };
  }
};

export const parseRawTx = (rawTxBase64) => {
  let decoded;
  try {
    decoded = decodeTxRaw(fromBase64(rawTxBase64));
  } catch (err) {
    console.error("Failed to decode tx:", err);
    return { messages: [], error: "Invalid raw transaction" };
  }
  const messages = decoded.body.messages.map((msg) => decodeEthereumTx(msg));
  return messages;
};
