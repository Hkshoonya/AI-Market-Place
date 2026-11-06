import { registerAdapter } from "../registry";
import { createOfficialArenaAdapter } from "../shared/official-arena-adapter";

export { parseOfficialArenaRow } from "../shared/official-arena";
export const OFFICIAL_TEXT_ARENA = "arena-text-official";
const adapter = createOfficialArenaAdapter("text");
registerAdapter(adapter);
export default adapter;
