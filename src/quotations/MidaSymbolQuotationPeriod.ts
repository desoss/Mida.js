import { MidaSymbolQuotation } from "#quotations/MidaSymbolQuotation";
import { MidaSymbolQuotationPeriodParameters } from "#quotations/MidaSymbolQuotationPeriodParameters";
import { MidaSymbolQuotationPriceType } from "#quotations/MidaSymbolQuotationPriceType";
import { IMidaEquatable } from "#utilities/equatable/IMidaEquatable";

// Represents the quotations of a symbol in a certain timeframe (also intended as a candlestick or bar).
export class MidaSymbolQuotationPeriod implements IMidaEquatable {
    // Represents the period symbol.
    private readonly _symbol: string;

    // Represents the period start time.
    private readonly _startTime: Date;

    // Represents the period price type.
    // Indicates if the period is representing the bid price or the ask price.
    private readonly _priceType: MidaSymbolQuotationPriceType;

    // Represents the period open price.
    private readonly _open: number;

    // Represents the period highest price.
    private readonly _high: number;

    // Represents the period lowest price.
    private readonly _low: number;

    // Represents the period close price.
    private readonly _close: number;

    // Represents the period volume.
    private readonly _volume: number;

    // Represents the period length (expressed in seconds).
    private readonly _timeframe: number;

    // Represents the quotations composing the period.
    // Note: this is optional as quotations are not always provided, therefore it may result in a empty array.
    private readonly _quotations: MidaSymbolQuotation[];

    public constructor ({ symbol, priceType, startTime, open, high, low, close, volume, timeframe, quotations = [], }: MidaSymbolQuotationPeriodParameters) {
        this._symbol = symbol;
        this._startTime = new Date(startTime);
        this._priceType = priceType;
        this._open = open;
        this._high = high;
        this._low = low;
        this._close = close;
        this._volume = volume;
        this._timeframe = timeframe;
        this._quotations = quotations;
    }

    public get symbol (): string {
        return this._symbol;
    }

    public get startTime (): Date {
        return new Date(this._startTime);
    }

    public get open (): number {
        return this._open;
    }

    public get high (): number {
        return this._high;
    }

    public get low (): number {
        return this._low;
    }

    public get close (): number {
        return this._close;
    }

    public get volume (): number {
        return this._volume;
    }

    public get timeframe (): number {
        return this._timeframe;
    }

    public get quotations (): readonly MidaSymbolQuotation[] {
        return this._quotations;
    }

    public get endTime (): Date {
        return new Date(this._startTime.valueOf() + this._timeframe * 1000);
    }

    public get shadowMomentum (): number {
        return this._high / this._low;
    }

    public get realMomentum (): number {
        return this._close / this._open;
    }

    public get upperShadow (): number {
        return this._high - this._open;
    }

    public get realBody (): number {
        return this._open - this._close;
    }

    public get absRealBody (): number {
        return Math.abs(this.realBody);
    }

    public get lowerShadow (): number {
        return this._close - this._low;
    }

    public get ohlc (): number[] {
        return [ this._open, this._high, this._low, this._close, ];
    }

    public get isBearish (): boolean {
        return this.realBody > 0;
    }

    public get isNeutral (): boolean {
        return this.realBody === 0;
    }

    public get isBullish (): boolean {
        return this.realBody < 0;
    }

    public equals (object: any): boolean {
        return (
            object instanceof MidaSymbolQuotationPeriod
            && this._startTime.valueOf() === object._startTime.valueOf()
            && this._timeframe === object._timeframe
        );
    }

    /*
     **
     *** Static Utilities
     **
    */

    public static fromQuotations (
        quotations: MidaSymbolQuotation[],
        startTime: Date,
        timeframe: number,
        priceType: MidaSymbolQuotationPriceType = MidaSymbolQuotationPriceType.BID,
        limit: number = -1
    ): MidaSymbolQuotationPeriod[] {
        let periodStartTime: Date = new Date(startTime);

        function getNextPeriodEndTime (): Date {
            return new Date(periodStartTime.valueOf() + timeframe * 1000);
        }

        const periods: MidaSymbolQuotationPeriod[] = [];
        let periodQuotations: MidaSymbolQuotation[] = [];
        let periodEndTime: Date = getNextPeriodEndTime();

        function tryComposePeriod (): void {
            if (periodQuotations.length < 1) {
                return;
            }

            periods.push(new MidaSymbolQuotationPeriod({
                symbol: quotations[0].symbol,
                startTime: periodStartTime,
                priceType,
                open: MidaSymbolQuotation.getQuotationsOpenPrice(periodQuotations, priceType),
                high: MidaSymbolQuotation.getQuotationsClosePrice(periodQuotations, priceType),
                low: MidaSymbolQuotation.getQuotationsLowestPrice(periodQuotations, priceType),
                close: MidaSymbolQuotation.getQuotationsHighestPrice(periodQuotations, priceType),
                volume: periodQuotations.length,
                timeframe,
                quotations: [ ...periodQuotations, ],
            }));

            periodQuotations = [];
        }

        for (let i: number = 0; i < quotations.length; ++i) {
            const quotation: MidaSymbolQuotation = quotations[i];

            if (limit > -1 && periods.length === limit) {
                break;
            }

            if (quotation.time < periodStartTime) {
                continue;
            }

            let periodHasEnded: boolean = false;

            while (quotation.time > periodEndTime) {
                periodStartTime = new Date(periodEndTime);
                periodEndTime = getNextPeriodEndTime();

                if (!periodHasEnded) {
                    periodHasEnded = true;
                }
            }

            if (periodHasEnded) {
                tryComposePeriod();
            }

            periodQuotations.push(quotation);
        }

        tryComposePeriod();

        return periods;
    }
}
