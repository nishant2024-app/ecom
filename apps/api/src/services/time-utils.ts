export const addMinutes = (d: Date, minutes: number) => new Date(d.getTime() + minutes * 60_000);
