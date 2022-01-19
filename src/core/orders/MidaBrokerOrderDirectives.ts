import { MidaEventListener } from "#events/MidaEventListener";
import { MidaBrokerOrderDirection } from "#orders/MidaBrokerOrderDirection";
import { MidaBrokerOrderPurpose } from "#orders/MidaBrokerOrderPurpose";
import { MidaBrokerOrderTimeInForce } from "#orders/MidaBrokerOrderTimeInForce";
import { MidaBrokerPositionProtection } from "#positions/MidaBrokerPositionProtection";

export type MidaBrokerOrderOpenDirectives = {
    purpose: MidaBrokerOrderPurpose.OPEN;
    symbol?: string;
    direction?: MidaBrokerOrderDirection;
    volume: number;
    limit?: number;
    stop?: number;
    protection?: MidaBrokerPositionProtection;
    positionId?: string;
} & MidaBrokerOrderAdvancedDirectives;

export type MidaBrokerOrderCloseDirectives = {
    purpose: MidaBrokerOrderPurpose.CLOSE;
    positionId: string;
    volume?: number;
} & MidaBrokerOrderAdvancedDirectives;

export type MidaBrokerOrderAdvancedDirectives = {
    resolverEvents?: string[];
    timeInForce?: MidaBrokerOrderTimeInForce;
    expirationTimestamp?: number;
    listeners?: {
        [eventType: string]: MidaEventListener;
    };
};

export type MidaBrokerOrderDirectives = MidaBrokerOrderOpenDirectives | MidaBrokerOrderCloseDirectives;
