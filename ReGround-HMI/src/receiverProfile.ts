// Replace this object with the same-shaped planning JSON when integration is ready.
export type ReceiverProfile = {
  jobId: string; profileId: string; project: string; receiver: string;
  distanceKm: number; material: string;
  acceptance: { moisture: { min: number; max: number; unit: "%" };
    fineFraction: { min: number; unit: "%" }; oversize: { max: number; unit: "%" } };
};
export const receiverProfile: ReceiverProfile = {
  jobId: "WRK-014", profileId: "RCP-014", project: "Warkworth Development · Zone B",
  receiver: "Local Clay Receiver", distanceKm: 12.1, material: "Clay-rich fines",
  acceptance: { moisture: { min: 14, max: 22, unit: "%" },
    fineFraction: { min: 70, unit: "%" }, oversize: { max: 5, unit: "%" } },
};
