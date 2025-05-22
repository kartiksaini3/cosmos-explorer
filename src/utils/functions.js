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

const currencies = [
  { name: "ATOM", divideByPower: 6 },
  { name: "OSMO", divideByPower: 6 },
  { name: "USDC", divideByPower: 6 },
  { name: "SWTH", divideByPower: 6 },
  { name: "BTC", divideByPower: 8 },
];

const getCurrencyData = (denom) =>
  currencies.find(({ name }) => denom?.includes(name?.toLowerCase())) || {
    name: "UNIT",
    divideByPower: 0,
  };

const resolveIbcDenom = async (denom) => {
  const ibcHash = denom.split("/")[1];
  const lcdUrl = `https://lcd.osmosis.zone/ibc/apps/transfer/v1/denom_traces/${ibcHash}`;

  try {
    if (!denom.startsWith("ibc/")) return getCurrencyData(denom);
    const res = await fetch(lcdUrl);
    if (!res.ok) throw new Error(`Failed to fetch denom trace: ${res.status}`);
    const data = await res.json();
    const baseDenom = data.denom_trace?.base_denom;
    console.log("baseDenom", baseDenom);
    return getCurrencyData(baseDenom);
  } catch (error) {
    console.error("Error resolving IBC denom:", error);
    return denom; // Fallback to raw IBC hash if resolution fails
  }
};

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

const decodeNativeTx = async (msg, fee) => {
  try {
    const parsed = typeof msg === "string" ? JSON.parse(msg) : msg;
    const type = msg?.typeUrl || "";
    console.log("type_type", msg, type, parsed);
    if (!nativeMsgTypeMapping[type]) return false;
    const decoded = nativeMsgTypeMapping[type]?.decode(parsed?.value);
    const amountAr = getAmountAr(decoded);
    const amount = amountAr
      ? await Promise.all(
          amountAr?.map(async (amt) => {
            let currency;
            try {
              currency = await resolveIbcDenom(amt?.denom || "");
            } catch {
              currency = {
                name: "UNIT",
                divideByPower: 0,
              };
            }
            console.log("currency", currency);
            return `${amt.amount / 10 ** currency?.divideByPower} ${
              currency?.name
            }`;
          })
        )
      : "-";
    console.log("decoded", amount, decoded);

    return {
      from: getFrom(decoded),
      to: getTo(decoded),
      amount,
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

export const parseRawTx = async (rawTxBase64, isNativeTxs = false) => {
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
  const messages = (
    await Promise.all(
      decoded.body.messages.map(async (msg) =>
        isNativeTxs ? await decodeNativeTx(msg, fee) : decodeEthereumTx(msg)
      )
    )
  ).filter(Boolean);
  return messages;
};
