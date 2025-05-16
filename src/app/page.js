"use client";

import axios from "axios";
import { useEffect, useState } from "react";
import Copy from "@/images/copy.svg";
import Reload from "@/images/reload.svg";
import { toast } from "react-toastify";
import Image from "next/image";

const FetchLast10 = () => {
  const [activeTab, setActiveTab] = useState("blocks");
  const [blocks, setBlocks] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "blocks") {
        const res = await axios.get("/api/blocks");
        const data = res?.data;
        setBlocks(data.blocks || []);
      } else {
        const res = await axios.get("/api/txs");
        const data = res?.data;
        setTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error("Client error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied to clipboard!", { type: "success" });
    } catch (err) {
      toast("Failed to copy", { type: "error" });
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Cosmos Explorer</h1>
      <div className="flex space-x-4 mb-4">
        <button
          className={`px-4 py-2 rounded cursor-pointer ${
            activeTab === "blocks"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-black"
          }`}
          onClick={() => setActiveTab("blocks")}
        >
          Blocks
        </button>
        <button
          className={`px-4 py-2 rounded cursor-pointer ${
            activeTab === "transactions"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-black"
          }`}
          onClick={() => setActiveTab("transactions")}
        >
          Transactions
        </button>
        <Image
          src={Reload}
          alt="Reload Icon"
          width={20}
          className="cursor-pointer invert"
          onClick={() => {
            !loading && fetchData();
          }}
        />
      </div>

      {loading ? (
        <p>Loading {activeTab}...</p>
      ) : activeTab === "blocks" ? (
        <div className="space-y-4">
          {blocks.map((block) => (
            <div key={block.height} className="p-4 border rounded-xl shadow">
              <p>
                <strong>Height:</strong> {block.height}
              </p>
              <p>
                <strong>Hash:</strong> {block.hash}
              </p>
              <p>
                <strong>Time:</strong> {new Date(block.time).toLocaleString()}
              </p>
              <p>
                <strong>Txs:</strong> {block.txs.length}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {transactions.map((tx, index) => (
            <div key={index} className="p-4 border rounded-xl shadow">
              <p>
                <strong>Height:</strong> {tx.height}
              </p>
              <p>
                <strong>Hash:</strong> {tx.hash}
              </p>
              <p>
                <strong>Time:</strong> {new Date(tx.time).toLocaleString()}
              </p>
              <p>
                <strong>Raw Tx:</strong>{" "}
                <code className="break-words text-sm">
                  {`${tx.rawTx.slice(0, 1000)}...`}
                  <Image
                    src={Copy}
                    alt="Copy Icon"
                    width={20}
                    className="cursor-pointer invert"
                    onClick={() => handleCopy(tx.rawTx)}
                  />
                </code>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FetchLast10;
