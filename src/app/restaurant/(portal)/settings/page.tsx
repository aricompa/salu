import { Card } from "@/components/ui";
import { requireMembership } from "@/lib/auth";
import { canManage } from "@/lib/roles";
import { getSettings } from "@/lib/settings";
import { OrderSettingsForm } from "./OrderSettingsForm";
import { ProfileForm } from "./ProfileForm";

export const metadata = { title: "Settings · Salu" };

/** Every zone this runtime knows, grouped by region, always including the current one. */
function timeZoneGroups(current: string) {
  const ids = new Set(Intl.supportedValuesOf("timeZone"));
  ids.add(current);
  const groups = new Map<string, string[]>();
  for (const id of [...ids].sort()) {
    const region = id.includes("/") ? id.slice(0, id.indexOf("/")) : "Other";
    groups.set(region, [...(groups.get(region) ?? []), id]);
  }
  return [...groups].map(([region, zoneIds]) => ({ region, ids: zoneIds }));
}

export default async function SettingsPage() {
  const { membership } = await requireMembership();
  const manage = canManage(membership.role);
  const settings = await getSettings(membership.restaurantId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Settings</h1>
        {!manage && <p className="text-muted">Owners and managers change these settings.</p>}
      </div>

      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Restaurant</h2>
        <ProfileForm
          name={settings.name}
          timezone={settings.timezone}
          zones={timeZoneGroups(settings.timezone)}
          disabled={!manage}
        />
        <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="text-muted">Link</dt>
          <dd>
            <code>{settings.slug}</code>{" "}
            <span className="text-muted">· set at sign-up, can&apos;t be changed yet</span>
          </dd>
          <dt className="text-muted">Currency</dt>
          <dd>{settings.currency.toUpperCase()}</dd>
        </dl>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Orders</h2>
        <OrderSettingsForm
          editWindowMins={settings.editWindowMins}
          additionCutoffMins={settings.additionCutoffMins}
          disabled={!manage}
        />
      </Card>
    </div>
  );
}
