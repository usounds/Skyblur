/* eslint-disable */
import type * as UkSkyblur from "./UkSkyblur";
import "@atcute/bluesky";

declare module "@atcute/lexicons/ambient" {
  interface XRPCProcedures extends UkSkyblur.Procedures { }
  interface Records extends UkSkyblur.Records { }
}
