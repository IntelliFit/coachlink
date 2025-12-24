/**
 * Extended subscription types for the product-based subscription model
 */
import { Database } from "./database.types";

// Original subscription row type
type BaseCoachSubscription =
    Database["public"]["Tables"]["coach_subscriptions"]["Row"];

// Extended coach subscription with product fields
export interface ExtendedCoachSubscription extends BaseCoachSubscription {
    product_id: string | null;
    product_name: string | null;
    product_tier: string | null;
    subscribed_weeks: number | null;
}

// Extended insert type
export interface ExtendedCoachSubscriptionInsert extends
    Omit<
        Database["public"]["Tables"]["coach_subscriptions"]["Insert"],
        "product_id" | "product_name" | "product_tier" | "subscribed_weeks"
    > {
    product_id?: string | null;
    product_name?: string | null;
    product_tier?: string | null;
    subscribed_weeks?: number | null;
}

// Extended update type
export interface ExtendedCoachSubscriptionUpdate extends
    Omit<
        Database["public"]["Tables"]["coach_subscriptions"]["Update"],
        "product_id" | "product_name" | "product_tier" | "subscribed_weeks"
    > {
    product_id?: string | null;
    product_name?: string | null;
    product_tier?: string | null;
    subscribed_weeks?: number | null;
}
