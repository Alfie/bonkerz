import {ConfirmedSignatureInfo} from "@solana/web3.js";
import { Action } from "@components/home/action";

type Props = {
    items: Array<ConfirmedSignatureInfo> | undefined;
};

export function ActionList({ items }: Props) {
    if (!items) {
      return null;
    }
  
    return (
      <div>
        {items.length === 0 ? (
          <p className="p-4">no actions performed ✨</p>
        ) : (
          items.map((item) => <Action sigInfo={item} />)
        )}
      </div>
    );
  }