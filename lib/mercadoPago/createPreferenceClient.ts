import { mpWebDebugClient, urlHostOnly } from "@/lib/mercadoPago/mpWebDebug";

export type CreatePreferenceResult = {
  preferenceId: string;
  redirectUrl: string;
  sandboxMode: boolean;
  redirectSource?: string;
};

export async function requestMercadoPagoPreference(params: {
  restaurantId: string;
  orderId: string;
  customerId: string;
}): Promise<CreatePreferenceResult> {
  mpWebDebugClient("create_preference_request_start", {
    hasRestaurantId: !!params.restaurantId?.trim(),
    hasOrderId: !!params.orderId?.trim(),
    hasCustomerId: !!params.customerId?.trim(),
  });

  let res: Response;
  try {
    res = await fetch("/api/mercado-pago/create-preference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "network_error";
    mpWebDebugClient("create_preference_request_error", { message });
    throw new Error(message);
  }

  const data = (await res.json()) as {
    error?: string;
    message?: string;
    preferenceId?: string;
    redirectUrl?: string;
    sandboxMode?: boolean;
    redirectSource?: string;
  };

  const redirectSource =
    typeof data.redirectSource === "string"
      ? data.redirectSource
      : data.sandboxMode
        ? "sandbox_init_point"
        : "init_point";

  mpWebDebugClient("create_preference_response", {
    httpStatus: res.status,
    ok: res.ok,
    errorCode: data.error ?? null,
    errorMessage: data.message ?? null,
    hasPreferenceId: !!data.preferenceId,
    hasRedirectUrl: !!data.redirectUrl,
    redirectUrlHost: urlHostOnly(data.redirectUrl),
    redirectSource: res.ok ? redirectSource : null,
    sandboxMode: data.sandboxMode === true,
  });

  if (!res.ok) {
    throw new Error(data.message ?? data.error ?? "No pudimos iniciar el pago en línea");
  }

  if (!data.preferenceId || !data.redirectUrl) {
    mpWebDebugClient("create_preference_incomplete_response", {
      hasPreferenceId: !!data.preferenceId,
      hasRedirectUrl: !!data.redirectUrl,
    });
    throw new Error("Respuesta de pago incompleta");
  }

  return {
    preferenceId: data.preferenceId,
    redirectUrl: data.redirectUrl,
    sandboxMode: data.sandboxMode === true,
    redirectSource,
  };
}
