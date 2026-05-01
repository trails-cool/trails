declare module "@garmin/fitsdk" {
  export class Encoder {
    constructor(options?: { fieldDescriptions?: unknown });
    writeMesg(mesg: { mesgNum: number; [field: string]: unknown }): this;
    onMesg(mesgNum: number, mesg: Record<string, unknown>): this;
    close(): Uint8Array;
  }

  export class Stream {
    static fromArrayBuffer(buf: ArrayBuffer): Stream;
    static fromBuffer(buf: Uint8Array | Buffer): Stream;
  }

  export class Decoder {
    constructor(stream: Stream);
    read(opts?: Record<string, unknown>): {
      messages: Record<string, Array<Record<string, unknown>>>;
      errors: unknown[];
    };
  }

  export const Profile: {
    version: { major: number; minor: number };
    MesgNum: {
      FILE_ID: number;
      FILE_CREATOR: number;
      COURSE: number;
      LAP: number;
      RECORD: number;
      EVENT: number;
      [key: string]: number;
    };
  };

  export const Utils: {
    convertDateToDateTime(date: Date): number;
    convertDateTimeToDate(dt: number): Date;
  };
}
