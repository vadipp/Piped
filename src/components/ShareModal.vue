<template>
    <ModalComponent>
        <h2 v-t="'actions.share'" class="mb-5" />
        <div class="flex justify-between">
            <label v-t="'actions.piped_link'" />
            <UiCheckbox v-model="pipedLink" @change="onChange" />
        </div>
        <hr />
        <div v-if="hasPlaylist && !sharingEnabled" class="flex justify-between">
            <label v-t="'actions.with_playlist'" />
            <UiCheckbox v-model="withPlaylist" @change="onChange" />
        </div>
        <div class="flex justify-between">
            <label v-t="'actions.with_timecode'" for="withTimeCode" />
            <UiCheckbox id="withTimeCode" v-model="withTimeCode" @change="onChange" />
        </div>
        <div v-if="withTimeCode" class="mt-2 flex items-center justify-between">
            <label v-t="'actions.time_code'" />
            <input
                v-model="timeStamp"
                class="h-8 w-12 rounded-md bg-gray-300 px-2.5 text-gray-600 focus:shadow-red-400 focus:outline-2 focus:outline-red-500 dark:bg-dark-400 dark:text-gray-400"
                type="text"
                @change="onChange"
            />
        </div>
        <hr />
        <p v-if="shareLoading" role="status" v-text="t('info.loading')" />
        <p v-if="shareError" role="alert" v-text="t('info.share_link_failed')" />
        <Button v-if="shareError" v-t="'actions.retry_share'" @click="createShare" />
        <a v-if="generatedLink" :href="generatedLink" target="_blank" rel="noopener noreferrer">
            <h3 class="mt-4" v-text="generatedLink" />
        </a>
        <QrCode v-if="showQrCode && generatedLink" :text="generatedLink" />
        <div class="mt-4 flex justify-end">
            <Button v-t="'actions.generate_qrcode'" :disabled="!generatedLink" @click="showQrCode = !showQrCode" />
            <Button v-t="'actions.follow_link'" :disabled="!generatedLink" class="ml-3" @click="followLink()" />
            <Button v-t="'actions.copy_link'" :disabled="!generatedLink" class="ml-3" @click="copyLink()" />
        </div>
    </ModalComponent>
</template>

<script setup>
import { ref, computed, onMounted, watch, defineAsyncComponent } from "vue";
import { useI18n } from "vue-i18n";
import ModalComponent from "./ModalComponent.vue";
import Button from "./ui/Button.vue";
import UiCheckbox from "./ui/Checkbox.vue";
import { getPreferenceBoolean, setPreference } from "@/composables/usePreferences.js";

const QrCode = defineAsyncComponent(() => import("./QrCode.vue"));

const { t } = useI18n();

const props = defineProps({
    videoId: {
        type: String,
        required: true,
    },
    currentTime: {
        type: Number,
        required: true,
    },
    playlistId: {
        type: String,
        default: undefined,
    },
    playlistIndex: {
        type: Number,
        default: undefined,
    },
});

const durations = [1, 60, 60 * 60, 60 * 60 * 24];

const withTimeCode = ref(true);
const pipedLink = ref(true);
const withPlaylist = ref(true);
const timeStamp = ref(null);
const hasPlaylist = ref(false);
const showQrCode = ref(false);
// Optional runtime configuration, supplied by the instance operator before Vue loads.
// Keep ordinary upstream links on instances without a sharing gateway.
const sharingEndpoint = window.PIPED_SHARING_API;
const sharingEnabled = typeof sharingEndpoint === "string" && sharingEndpoint.length > 0;
const shareURL = ref("");
const shareLoading = ref(false);
const shareError = ref(false);
let shareRequest = 0;

async function createShare() {
    if (!sharingEnabled || !pipedLink.value) return;
    const request = ++shareRequest;
    shareURL.value = "";
    shareLoading.value = true;
    shareError.value = false;
    try {
        const endpoint = new URL(sharingEndpoint, window.location.origin);
        if (endpoint.origin !== window.location.origin) throw new Error("Sharing endpoint must be same-origin");
        const response = await fetch(endpoint, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoId: props.videoId }),
        });
        if (!response.ok) throw new Error("Unable to create shared link");
        const result = await response.json();
        const url = new URL(result.url);
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Invalid shared link");
        if (request === shareRequest) shareURL.value = url.href;
    } catch {
        if (request === shareRequest) shareError.value = true;
    } finally {
        if (request === shareRequest) shareLoading.value = false;
    }
}

watch([pipedLink, () => props.videoId], () => {
    ++shareRequest;
    shareLoading.value = false;
    shareError.value = false;
    shareURL.value = "";
    createShare();
});

const generatedLink = computed(() => {
    if (pipedLink.value && sharingEnabled && !shareURL.value) return "";
    const baseUrl = pipedLink.value
        ? sharingEnabled
            ? shareURL.value
            : window.location.origin + "/watch?v=" + props.videoId
        : "https://youtu.be/" + props.videoId;
    const url = new URL(baseUrl);

    if (withTimeCode.value && timeStamp.value) url.searchParams.append("t", parseTimeStampToSeconds(timeStamp.value));

    if (hasPlaylist.value && withPlaylist.value && !sharingEnabled) {
        url.searchParams.append("list", props.playlistId);
        url.searchParams.append("index", props.playlistIndex);
    }

    return url.href;
});

onMounted(() => {
    timeStamp.value = parseSecondsToTimeStamp(props.currentTime ?? 0);
    withTimeCode.value = getPreferenceBoolean("shareWithTimeCode", true);
    pipedLink.value = getPreferenceBoolean("shareAsPipedLink", true);
    withPlaylist.value = getPreferenceBoolean("shareWithPlaylist", true);
    hasPlaylist.value = props.playlistId != undefined && !isNaN(props.playlistIndex);
    createShare();
});

function followLink() {
    if (generatedLink.value) window.open(generatedLink.value, "_blank", "noopener,noreferrer");
}

async function copyLink() {
    if (generatedLink.value) await copyURL(generatedLink.value);
}

async function copyURL(mytext) {
    try {
        await navigator.clipboard.writeText(mytext);
        alert(t("info.copied"));
    } catch {
        alert(t("info.cannot_copy"));
    }
}

function parseTimeStampToSeconds(timestamp) {
    const timeArray = timestamp.split(":").reverse();
    let seconds = 0;
    for (let i = 0; i < timeArray.length; i++) {
        seconds += timeArray[i] * durations[i];
    }
    return seconds;
}

function parseSecondsToTimeStamp(seconds) {
    const timeArray = [];
    const durationsReversed = durations.toReversed();
    for (let i in durationsReversed) {
        const currentValue = Math.floor(seconds / durationsReversed[i]);
        if (currentValue > 0) {
            timeArray.push(currentValue.toString().padStart(2, "0"));
            seconds -= currentValue * durationsReversed[i];
        }
    }
    return timeArray.join(":");
}

function onChange() {
    setPreference("shareWithTimeCode", withTimeCode.value, true);
    setPreference("shareAsPipedLink", pipedLink.value, true);
    setPreference("shareWithPlaylist", withPlaylist.value, true);
}
</script>
