<script setup lang="ts">
import { computed, ref } from "vue";
import Button from "@/components/ui/Button.vue";
import FilterChipGroup from "@/components/FilterChipGroup.vue";
import { scanUrls, type ScanResult } from "@/scan/client";
import { lastPostAgeLabel } from "@/scan/presentation";
import {
  MIN_ACTIVITY_DAYS,
  rankFeeds,
  type RankedBucket,
  type RankedFeed,
} from "@/scan/rankFeeds";
import type { ReaderAdapter, ReaderFeedSummary } from "@/tools/types";

const props = defineProps<{
  adapter: ReaderAdapter | null;
  busy: boolean;
}>();

const emit = defineEmits<{
  status: [string];
  error: [string];
}>();

const auditing = ref(false);
const audited = ref<RankedFeed<ReaderFeedSummary>[] | null>(null);

const checkTitle = ref("");
const checkUrl = ref("");
const checking = ref(false);
const checked = ref<RankedFeed<{ title: string; xmlUrl: string }> | null>(null);

const freshCount = computed(
  () => audited.value?.filter((r) => r.bucket === "fresh").length ?? 0,
);
const inactiveCount = computed(
  () => audited.value?.filter((r) => r.bucket === "inactive").length ?? 0,
);
const unverifiedCount = computed(
  () => audited.value?.filter((r) => r.bucket === "unverified").length ?? 0,
);

type HealthFilter = "all" | RankedBucket;
const healthFilter = ref<HealthFilter>("all");

const filterOptions = computed(() => [
  { id: "all" as const, label: `All (${audited.value?.length ?? 0})` },
  { id: "fresh" as const, label: `Active (${freshCount.value})` },
  { id: "inactive" as const, label: `Inactive (${inactiveCount.value})` },
  {
    id: "unverified" as const,
    label: `Unverified (${unverifiedCount.value})`,
  },
]);

const visibleAudited = computed(() => {
  if (!audited.value) return [];
  if (healthFilter.value === "all") return audited.value;
  return audited.value.filter((r) => r.bucket === healthFilter.value);
});

async function runAudit() {
  if (!props.adapter) return;
  emit("error", "");
  auditing.value = true;
  audited.value = null;
  healthFilter.value = "all";
  try {
    const feeds = await props.adapter.listFeeds();
    const results = await scanUrls(feeds.map((f) => f.xmlUrl));
    const scans = new Map(results.map((r) => [r.xmlUrl, r] as const));
    audited.value = rankFeeds(feeds, scans);
    emit("status", `Checked ${feeds.length} feed(s).`);
  } catch (e) {
    emit("error", e instanceof Error ? e.message : "Health check failed.");
  } finally {
    auditing.value = false;
  }
}

async function runCheck() {
  const xmlUrl = checkUrl.value.trim();
  if (!xmlUrl) return;
  emit("error", "");
  checking.value = true;
  checked.value = null;
  try {
    const candidate = { title: checkTitle.value.trim() || xmlUrl, xmlUrl };
    const [result] = await scanUrls([xmlUrl]);
    const scans = new Map<string, ScanResult>(result ? [[xmlUrl, result]] : []);
    checked.value = rankFeeds([candidate], scans)[0];
  } catch (e) {
    emit("error", e instanceof Error ? e.message : "Check failed.");
  } finally {
    checking.value = false;
  }
}

function volumeLabel(scan?: ScanResult): string {
  if (!scan) return "";
  return `${scan.posts30d ?? 0} posts/30d · ${lastPostAgeLabel(scan.lastDatedAt) ?? "no dated posts"}`;
}
</script>

<template>
  <div class="space-y-5" role="tabpanel">
    <section class="space-y-2">
      <h3 class="text-sm font-semibold text-gr-text">Existing feeds</h3>
      <p class="text-xs text-gr-text-muted">
        Ranks feeds by posting volume over the last {{ MIN_ACTIVITY_DAYS }} days
        — catches a feed that parses fine but has quietly gone dark or thin
        (e.g. a publisher's low-volume secondary endpoint outranked by its main
        one).
      </p>
      <Button
        variant="secondary"
        size="sm"
        :disabled="!adapter || busy || auditing"
        @click="runAudit"
      >
        {{ auditing ? "Checking…" : "Check all feeds" }}
      </Button>

      <div v-if="audited" class="space-y-3 pt-1">
        <FilterChipGroup
          v-model="healthFilter"
          :options="filterOptions"
          group-aria-label="Filter feeds by health"
          variant="segmented"
        />

        <p v-if="!visibleAudited.length" class="text-xs text-gr-text-muted">
          No feeds in this filter.
        </p>

        <ul v-else class="space-y-1">
          <li
            v-for="r in visibleAudited"
            :key="r.candidate.id"
            class="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs"
            :class="
              r.bucket === 'inactive'
                ? 'border-l-4 border-l-gr-gold bg-gr-surface-2'
                : 'border border-gr-border bg-gr-surface'
            "
          >
            <span
              class="truncate"
              :class="
                r.bucket === 'unverified'
                  ? 'text-gr-text-muted'
                  : 'text-gr-text'
              "
              >{{ r.candidate.title }}</span
            >
            <span class="shrink-0 text-gr-text-muted">
              <template v-if="r.bucket === 'fresh'">{{
                volumeLabel(r.scan)
              }}</template>
              <template v-else-if="r.bucket === 'inactive'">{{
                r.reason
              }}</template>
              <template v-else>could not verify</template>
            </span>
          </li>
        </ul>
      </div>
    </section>

    <section class="space-y-2 border-t border-gr-border pt-3">
      <h3 class="text-sm font-semibold text-gr-text">
        Check a feed before adding
      </h3>
      <p class="text-xs text-gr-text-muted">
        Paste a candidate feed URL to confirm it's actually active before you
        subscribe or add it to the directory.
      </p>
      <div class="flex flex-wrap gap-2">
        <input
          v-model="checkTitle"
          class="min-w-0 flex-1 rounded-md border border-gr-border px-3 py-2 text-sm"
          placeholder="Title (optional)"
        />
        <input
          v-model="checkUrl"
          class="min-w-0 flex-[2] rounded-md border border-gr-border px-3 py-2 text-sm"
          placeholder="https://example.com/feed.xml"
        />
        <Button
          variant="secondary"
          size="sm"
          :disabled="!checkUrl.trim() || busy || checking"
          @click="runCheck"
        >
          {{ checking ? "Checking…" : "Check" }}
        </Button>
      </div>

      <p
        v-if="checked"
        class="rounded-md border px-2.5 py-1.5 text-xs"
        :class="
          checked.bucket === 'fresh'
            ? 'border-gr-border bg-gr-surface text-gr-text'
            : 'border-l-4 border-l-gr-gold bg-gr-surface-2 text-gr-text'
        "
      >
        <template v-if="checked.bucket === 'fresh'">
          Active — {{ volumeLabel(checked.scan) }}
        </template>
        <template v-else-if="checked.bucket === 'inactive'">
          Inactive — {{ checked.reason }}
        </template>
        <template v-else> Could not verify this URL. </template>
      </p>
    </section>
  </div>
</template>
