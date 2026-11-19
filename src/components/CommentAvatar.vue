<template>
    <span
        class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 text-gray-500 dark:bg-dark-400 dark:text-gray-400"
        aria-hidden="true"
    >
        <img
            v-if="src && failedSource !== src"
            :src="src"
            loading="lazy"
            class="size-full object-cover"
            alt=""
            @error="failedSource = src"
        />
        <i-fa6-solid-user v-else class="size-1/2" />
    </span>
</template>

<script setup>
import { ref } from "vue";

defineProps({ src: { type: String, default: null } });
const failedSource = ref(null);
</script>
