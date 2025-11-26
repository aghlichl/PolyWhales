import { User, UserAlertSettings, AlertType } from "../../generated/client";

export interface AlertEvent {
    type: AlertType;
    title: string;
    description: string;
    timestamp: Date;
    data: Record<string, any>; // Flexible payload for different alert types

    // Context for routing
    walletAddress?: string;
    marketId?: string;
    assetId?: string;
}

export type UserWithSettings = User & {
    alertSettings: UserAlertSettings | null;
};

export interface NotificationTransport {
    name: string;
    send(user: UserWithSettings, event: AlertEvent): Promise<void>;
}
