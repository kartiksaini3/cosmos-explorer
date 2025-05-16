import { decodeTxRaw } from "@cosmjs/proto-signing";
import { fromBase64 } from "@cosmjs/encoding";
// import { TransactionType } from "@ethereumjs/tx";
// import { Buffer } from "buffer";
// import { bytesToHex } from "@ethereumjs/util";
import { ethers } from "ethers";

const extractFunctionsFromMsgExecuteContract = (msg) => {
  try {
    const parsed = typeof msg.msg === "string" ? JSON.parse(msg.msg) : msg.msg;
    const functionName = Object.keys(parsed || {})[0];
    return {
      functionName: functionName || "unknown",
      payload: parsed?.[functionName] || {},
    };
  } catch (e) {
    return { functionName: "unknown", payload: {} };
  }
};

// const decodeEthereumTx = (msg) => {
//   try {
//     const base64Tx = msg.data; // or msg.tx.data or msg.tx, depending on your structure
//     const rawBytes = fromBase64(base64Tx);

//     // Parse the Ethereum transaction
//     const ethTx = TransactionType.fromSerializedData(Buffer.from(rawBytes));

//     return {
//       method: "MsgEthereumTx",
//       from: tx.getSenderAddress().toString(),
//       to: tx.to?.toString() || null,
//       value: tx.value.toString(),
//       data: bytesToHex(tx.data),
//       gasLimit: tx.gasLimit.toString(),
//       gasPrice: tx.maxFeePerGas?.toString() || tx.gasPrice?.toString() || null,
//     };
//   } catch (err) {
//     console.error("Failed to decode MsgEthereumTx", err);
//     return {
//       method: "MsgEthereumTx",
//       error: "Failed to decode EVM transaction",
//       raw: msg,
//     };
//   }
// };
const decodeEthereumTx = (msg) => {
  try {
    console.log("msg", msg);

    const rawBytes = fromBase64(msg);
    const tx = ethers.utils.parseTransaction(rawBytes);
    return tx;
  } catch (err) {
    console.error("Failed to decode MsgEthereumTx", err);
    return {
      method: "MsgEthereumTx",
      error: "Failed to decode EVM transaction",
      raw: msg,
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

  const messages = decoded.body.messages.map((msg) => {
    const type = msg["@type"] || msg.typeUrl || "unknown";
    if (type === "/cosmwasm.wasm.v1.MsgExecuteContract") {
      const { functionName, payload } =
        extractFunctionsFromMsgExecuteContract(msg);
      return {
        method: "MsgExecuteContract",
        functionName,
        from: msg.sender,
        to: msg.contract,
        payload,
      };
    }

    if (type === "/cosmwasm.wasm.v1.MsgInstantiateContract") {
      return {
        method: "MsgInstantiateContract",
        from: msg.sender,
        codeId: msg.code_id,
        label: msg.label,
        payload: msg.msg || {},
        funds: msg.funds?.map((f) => `${f.amount} ${f.denom}`) || [],
      };
    }

    if (type === "/cosmos.bank.v1beta1.MsgSend") {
      return {
        method: "MsgSend",
        from: msg.from_address,
        to: msg.to_address,
        amount: msg.amount?.map((a) => `${a.amount} ${a.denom}`) || [],
      };
    }

    if (type === "/ethermint.evm.v1.MsgEthereumTx") {
      return decodeEthereumTx(msg);
    }

    return {
      method: type,
      raw: msg,
    };
  });

  return { messages };
};
