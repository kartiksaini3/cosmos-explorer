import { decodeTxRaw } from "@cosmjs/proto-signing";
import { fromBase64 } from "@cosmjs/encoding";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
// import { MsgEthereumTx } from "evmos-proto/ethermint/evm/v1/tx";

const decodeEthereumTx = (msg) => {
  try {
    const parsed = typeof msg === "string" ? JSON.parse(msg) : msg;
    const functionName = Object.keys(parsed)[0];
    const payload = parsed[functionName];
    const type = msg?.typeUrl || "";
    console.log("type_type", msg, type, parsed);
    // const typeMap = {
    //   "/ethermint.evm.v1.MsgEthereumTx": MsgEthereumTx,
    // };
    if (
      type.startsWith("/cosmos.") ||
      type.startsWith("/ibc.")
      // ||
      // !typeMap[type]
    )
      return false;
    // const decoded = typeMap[type]?.decode(parsed?.value);
    // console.log("decoded", decoded);

    return {
      functionName,
      payload,
    };
  } catch (e) {
    console.log("errrr", e);

    return {
      functionName: "unknown",
      payload: {},
    };
  }
};

const decodeNativeTx = (msg, fee) => {
  try {
    const parsed = typeof msg === "string" ? JSON.parse(msg) : msg;
    const type = msg?.typeUrl || "";
    console.log("type_type", msg, type, parsed);
    const typeMap = {
      "/cosmos.bank.v1beta1.MsgSend": MsgSend,
    };
    if (
      (!type.startsWith("/cosmos.") && !type.startsWith("/ibc.")) ||
      !typeMap[type]
    )
      return false;
    const decoded = typeMap[type]?.decode(parsed?.value);

    return {
      from: decoded?.fromAddress,
      to: decoded?.toAddress,
      amount: decoded.amount.map((amt) => `${amt.amount / 10 ** 6} ATOM`),
      fee,
    };
  } catch (e) {
    return {
      from: undefined,
      to: undefined,
      amount: undefined,
    };
  }
};

export const parseRawTx = (rawTxBase64, isNativeTxs = false) => {
  let decoded;
  try {
    decoded = decodeTxRaw(fromBase64(rawTxBase64));
  } catch (err) {
    console.error("Failed to decode tx:", err);
    return { messages: [], error: "Invalid raw transaction" };
  }
  const fee = decoded.authInfo.fee.amount.map(
    (amt) => `${amt.amount / 10 ** 6} ATOM`
  );
  const messages = decoded.body.messages
    .map((msg) =>
      isNativeTxs ? decodeNativeTx(msg, fee) : decodeEthereumTx(msg)
    )
    .filter(Boolean);
  return messages;
};
