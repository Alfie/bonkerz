import React from "react";
import {ConfirmedSignatureInfo} from "@solana/web3.js";

type Props = {
  sigInfo: ConfirmedSignatureInfo;
};

export function Action({ sigInfo }: Props) {

  return (
    <div>
        {JSON.stringify(sigInfo)}
    </div>
  );
}