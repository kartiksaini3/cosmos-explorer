import { decodeTxRaw } from "@cosmjs/proto-signing";
import { fromBase64 } from "@cosmjs/encoding";
import { MsgSend, MsgMultiSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import {
  MsgDelegate,
  MsgUndelegate,
  MsgBeginRedelegate,
} from "cosmjs-types/cosmos/staking/v1beta1/tx";
import {
  MsgSubmitProposal,
  MsgVote,
  MsgDeposit,
} from "cosmjs-types/cosmos/gov/v1beta1/tx";
import { MsgUnjail } from "cosmjs-types/cosmos/slashing/v1beta1/tx";
import {
  MsgWithdrawDelegatorReward,
  MsgSetWithdrawAddress,
  MsgWithdrawValidatorCommission,
} from "cosmjs-types/cosmos/distribution/v1beta1/tx";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import {
  MsgStoreCode,
  MsgInstantiateContract,
  MsgExecuteContract,
  MsgMigrateContract,
  MsgUpdateAdmin,
  MsgClearAdmin,
} from "cosmjs-types/cosmwasm/wasm/v1/tx";

const contractMsgTypeMapping = {
  "/cosmwasm.wasm.v1.MsgStoreCode": MsgStoreCode,
  "/cosmwasm.wasm.v1.MsgInstantiateContract": MsgInstantiateContract,
  "/cosmwasm.wasm.v1.MsgExecuteContract": MsgExecuteContract,
  "/cosmwasm.wasm.v1.MsgMigrateContract": MsgMigrateContract,
  "/cosmwasm.wasm.v1.MsgUpdateAdmin": MsgUpdateAdmin,
  "/cosmwasm.wasm.v1.MsgClearAdmin": MsgClearAdmin,
};

const nativeMsgTypeMapping = {
  "/cosmos.bank.v1beta1.MsgSend": MsgSend,
  "/cosmos.bank.v1beta1.MsgMultiSend": MsgMultiSend,
  "/cosmos.staking.v1beta1.MsgDelegate": MsgDelegate,
  "/cosmos.staking.v1beta1.MsgUndelegate": MsgUndelegate,
  "/cosmos.staking.v1beta1.MsgBeginRedelegate": MsgBeginRedelegate,
  "/cosmos.gov.v1beta1.MsgSubmitProposal": MsgSubmitProposal,
  "/cosmos.gov.v1beta1.MsgVote": MsgVote,
  "/cosmos.gov.v1beta1.MsgDeposit": MsgDeposit,
  "/cosmos.slashing.v1beta1.MsgUnjail": MsgUnjail,
  "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward":
    MsgWithdrawDelegatorReward,
  "/cosmos.distribution.v1beta1.MsgSetWithdrawAddress": MsgSetWithdrawAddress,
  "/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission":
    MsgWithdrawValidatorCommission,
  "/ibc.applications.transfer.v1.MsgTransfer": MsgTransfer,
};

const getFrom = (decoded) =>
  decoded?.fromAddress || decoded?.delegatorAddress || decoded?.sender || "-";
const getTo = (decoded) =>
  decoded?.toAddress || decoded?.validatorAddress || decoded?.receiver || "-";
const getAmountAr = (decoded) => decoded?.amount || [decoded?.token];

const decodeEthereumTx = (msg) => {
  try {
    const parsed = typeof msg === "string" ? JSON.parse(msg) : msg;
    const functionName = Object.keys(parsed)[0];
    const payload = parsed[functionName];
    const type = msg?.typeUrl || "";
    console.log("type_type", msg, type, parsed);
    if (!contractMsgTypeMapping[type]) return false;
    const decoded = contractMsgTypeMapping[type]?.decode(parsed?.value);
    const amountAr = getAmountAr(decoded);
    console.log("decoded", decoded, amountAr);

    return {
      functionName,
      payload,
    };
  } catch (e) {
    console.log("errrr-CONTRACT", e);
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
    if (!nativeMsgTypeMapping[type]) return false;
    const decoded = nativeMsgTypeMapping[type]?.decode(parsed?.value);
    console.log("decoded", decoded);
    const amountAr = getAmountAr(decoded);

    return {
      from: getFrom(decoded),
      to: getTo(decoded),
      amount: amountAr
        ? amountAr?.map(
            (amt) =>
              `${amt.amount / 10 ** 6} ${amt?.denom?.slice(1)?.toUpperCase()}`
          )
        : "-",
      fee: fee || "-",
    };
  } catch (e) {
    console.log("errrr-NATIVE", e);
    return {
      from: "-",
      to: "-",
      amount: "-",
      fee: "-",
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
    (amt) => `${amt.amount / 10 ** 6} ${amt?.denom?.slice(1)?.toUpperCase()}`
  );
  const messages = decoded.body.messages
    .map((msg) =>
      isNativeTxs ? decodeNativeTx(msg, fee) : decodeEthereumTx(msg)
    )
    .filter(Boolean);
  return messages;
};
