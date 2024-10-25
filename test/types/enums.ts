export enum TaskStatus {
  None,
  PendingGeneration,
  PendingValidation,
  Completed,
}

export enum OracleKind {
  Generator,
  Validator,
}

export enum State {
  None,
  OracleRequest,
  ReadingResult,
}

export enum Phase {
  Sell,
  Buy,
  Withdraw,
}

export enum AssetStatus {
  Unlisted,
  Listed,
  Sold,
}
