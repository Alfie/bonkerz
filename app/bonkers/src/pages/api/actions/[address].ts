import { NETWORK } from "@utils/endpoints";
import type { NextApiRequest, NextApiResponse } from "next";

import { ItemData } from "@components/home/item";
import { fetcher } from "@utils/use-data-fetch";
import {Connection, PublicKey, ConfirmedSignatureInfo} from "@solana/web3.js";

//export type NftResponse = { nfts: Array<ItemData> };

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<String>
  ) {
    const connection = new Connection(NETWORK);
    const { address } = req.query;
    const addressPk = new PublicKey({address});
  
    if (address && address.length > 0) {
      const txnSigs = await connection.getSignaturesForAddress(addressPk);
  
      res.status(200).json("test");
    }
  
    res.status(400);
  }