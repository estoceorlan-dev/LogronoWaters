import { useState } from "react";
import { api, money } from "../lib/api";
import { PageHeader, SaveForm, Field } from "../components/UI";
import { useStation } from "../lib/station";

export default function Settings() {
  const { settings, user, refreshSettings } = useStation();
  const [saved, setSaved] = useState(false);
  return (
    <>
      <PageHeader
        title="Station settings"
        description="Manage your station details, refill prices, and reporting preferences."
      />
      <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
        <div className="panel p-6">
          {user.role === "admin" ? (
            <>
              <h2 className="font-semibold text-lg mb-5">
                Business details and pricing
              </h2>
              {saved && (
                <p
                  role="status"
                  className="p-3 mb-4 rounded-lg bg-emerald-50 text-emerald-800"
                >
                  Station settings saved.
                </p>
              )}
              <SaveForm
                onSubmit={async (d) => {
                  setSaved(false);
                  await api("settings", {
                    method: "PUT",
                    body: {
                      name: d.name,
                      address: d.address,
                      phone: d.phone,
                      price_cents: Math.round(Number(d.price) * 100),
                      delivery_fee_cents: Math.round(Number(d.delivery) * 100),
                      timezone: d.timezone,
                    },
                  });
                  setSaved(true);
                  refreshSettings();
                }}
              >
                <Field label="Station name">
                  <input
                    className="input"
                    name="name"
                    required
                    maxLength={100}
                    defaultValue={settings.name}
                  />
                </Field>
                <Field label="Station address">
                  <textarea
                    className="input"
                    name="address"
                    maxLength={500}
                    defaultValue={settings.address}
                    rows={2}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    className="input"
                    name="phone"
                    type="tel"
                    maxLength={40}
                    defaultValue={settings.phone}
                  />
                </Field>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Refill price per 5-gallon container (PHP)">
                    <input
                      className="input"
                      type="number"
                      name="price"
                      min="0.01"
                      max="100000"
                      step="0.01"
                      defaultValue={settings.price_cents / 100}
                      required
                    />
                  </Field>
                  <Field label="Delivery fee per order (PHP)">
                    <input
                      className="input"
                      type="number"
                      name="delivery"
                      min="0"
                      max="100000"
                      step="0.01"
                      defaultValue={settings.delivery_fee_cents / 100}
                      required
                    />
                  </Field>
                </div>
                <Field label="Reporting timezone">
                  <select
                    className="input"
                    name="timezone"
                    defaultValue={settings.timezone}
                  >
                    <option value="Asia/Manila">
                      Philippines (Asia/Manila)
                    </option>
                    <option value="UTC">UTC</option>
                  </select>
                </Field>
                <p className="text-sm text-slate-500">
                  New prices apply to future orders. Existing orders keep their
                  original prices.
                </p>
              </SaveForm>
            </>
          ) : (
            <>
              <h2 className="font-semibold text-lg">{settings.name}</h2>
              <p className="mt-3">{settings.address}</p>
              <p>{settings.phone}</p>
              <p className="mt-4">
                Refill: {money(settings.price_cents)} · Delivery:{" "}
                {money(settings.delivery_fee_cents)}
              </p>
              <p className="text-slate-500 text-sm mt-4">
                Only an administrator can change station settings.
              </p>
            </>
          )}
        </div>
        <div className="space-y-5">
          <div className="panel p-6">
            <h2 className="font-semibold mb-3">Your account</h2>
            <p>{user.name}</p>
            <p className="text-sm text-slate-500 break-all">{user.email}</p>
            <p className="text-sm capitalize text-blue-600 mt-2">{user.role}</p>
          </div>
          <div className="panel p-6">
            <h2 className="font-semibold mb-3">Staff access</h2>
            <p className="text-sm text-slate-500">
              Station access is managed by your administrator. Contact them to
              add or remove approved staff accounts. Staff must verify their
              email before accessing station records.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
