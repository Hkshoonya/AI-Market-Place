import { registerAdapter } from "../registry";
import { createOfficialArenaAdapter } from "../shared/official-arena-adapter";

const adapter = createOfficialArenaAdapter("vision");
registerAdapter(adapter);
export default adapter;
