import { NativeModule, requireNativeModule } from "expo";
import type { TextBlock } from "./ReceiptOcr.types";

declare class ReceiptOcrModule extends NativeModule {
  isSupported: boolean;
  readBlocks(uri: string): Promise<TextBlock[]>;
}

export default requireNativeModule<ReceiptOcrModule>("ReceiptOcr");
