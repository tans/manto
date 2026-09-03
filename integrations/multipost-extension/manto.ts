import type { DynamicData, SyncData } from "../common";

interface MantoConfig {
  apiKey: string;
}

interface MantoPublishResponse {
  content_id: string;
  operation: "created" | "updated" | "unchanged";
  quota?: { used: number; limit: number };
}

// 馒头新闻 Manto 是纯 API 平台，不需要操作页面元素，直接调用公开 HTTP 接口即可。
// injectUrl 指向 manto.xin，脚本在同源页面执行，避免跨域问题。
export async function DynamicManto(data: SyncData) {
  function createFloatingTip() {
    const host = document.createElement("div");
    const tip = document.createElement("div");

    host.style.position = "fixed";
    host.style.bottom = "20px";
    host.style.right = "20px";
    host.style.zIndex = "9999";
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });

    tip.innerHTML = `
    <style>
      .float-tip {
        background: #1e293b;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        animation: slideIn 0.3s ease-out;
      }
      @keyframes slideIn {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    </style>
    <div class="float-tip">
      正在发布内容到馒头新闻 Manto...
    </div>
  `;
    shadow.appendChild(tip);

    return {
      host,
      updateMessage: (message: string) => {
        const tipElement = shadow.querySelector(".float-tip");
        if (tipElement) {
          tipElement.textContent = message;
        }
      },
      remove: () => {
        setTimeout(() => {
          document.body.removeChild(host);
        }, 3000);
      },
    };
  }

  const floatingTip = createFloatingTip();

  try {
    const extraConfig = data.platforms.find((platform) => platform.name === "DYNAMIC_MANTO")
      ?.extraConfig as MantoConfig;

    if (!extraConfig?.apiKey) {
      throw new Error("缺少 API Key，请在平台设置中配置馒头新闻 Manto 的 API Key");
    }

    const { title, content, tags } = data.data as DynamicData;

    // 图片无法上传到 Manto，仅将可外链的图片地址附在正文末尾，避免信息丢失。
    const images = (data.data as DynamicData).images || [];
    const externalImages = images
      .map((image) => image.url)
      .filter((url) => url.startsWith("http://") || url.startsWith("https://"));
    const imageSuffix = externalImages.length
      ? `\n\n${externalImages.map((url) => url).join("\n")}`
      : "";
    const tagSuffix = tags?.length ? `\n\n${tags.map((tag) => `#${tag}`).join(" ")}` : "";
    const finalContent = `${content || ""}${imageSuffix}${tagSuffix}`;

    // external_id 使用标题，保证重复发布同一条动态时幂等更新而不是产生重复内容。
    const response = await fetch("https://manto.xin/v1/content", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${extraConfig.apiKey}`,
      },
      body: JSON.stringify({
        external_id: title,
        title,
        content: finalContent,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      const errorCode = (responseData as { error?: string })?.error || response.status;
      throw new Error(errorMessage(errorCode));
    }

    const result = responseData as MantoPublishResponse;
    const operationText =
      result.operation === "created"
        ? "发布成功"
        : result.operation === "updated"
          ? "更新成功"
          : "内容未变化";

    floatingTip.updateMessage(
      `馒头新闻 Manto ${operationText}${result.quota ? `（今日 ${result.quota.used}/${result.quota.limit}）` : ""}`,
    );
    console.log("馒头新闻 Manto 发布成功", result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    floatingTip.updateMessage(`馒头新闻 Manto 发布失败：${message}`);
    console.error("馒头新闻 Manto 发布失败", error);
    throw error;
  } finally {
    floatingTip.remove();
  }
}

function errorMessage(code: string | number): string {
  const messages: Record<string, string> = {
    authorization_required: "API Key 无效或已失效",
    daily_quota_exceeded: "今日发布配额已用完，请明天再试",
    title_and_content_required: "标题和内容不能为空",
  };
  return messages[String(code)] || `发布失败（${code}）`;
}
