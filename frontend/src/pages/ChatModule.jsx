import {
  Fragment,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import {
  buildChatMentionNotificationBody,
  formatChatDateTime,
} from "../utils/chatDisplay";
import {
  GENERAL_ATTACHMENT_ACCEPT,
  GENERAL_ATTACHMENT_OPTIONS,
  validateFile,
} from "../utils/fileValidation";

const getUser = () => JSON.parse(localStorage.getItem("user") || "{}");

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getMentionContext = (value, cursorPosition) => {
  const text = String(value || "");
  const end = Number.isInteger(cursorPosition) ? cursorPosition : text.length;
  const beforeCursor = text.slice(0, end);
  const match = beforeCursor.match(/(^|\s)@([^\s@]*)$/);

  if (!match) return null;

  const query = String(match[2] || "");
  const start = end - query.length - 1;

  if (start < 0) return null;

  return {
    start,
    end,
    query,
  };
};

const getMentionIdsFromText = (text, mentions) => {
  const messageText = String(text || "").toLowerCase();

  return mentions
    .filter((item) => messageText.includes(`@${String(item.name || "").toLowerCase()}`))
    .map((item) => item.id);
};

const getMentionMemberTokenLabel = (member) =>
  String(member?.employeeName || member?.email || member?.employeeCode || "Employee").trim();

const getMentionMemberTitle = (member) =>
  String(
    member?.employeeName ||
      member?.displayName ||
      member?.email ||
      member?.employeeCode ||
      "Employee"
  ).trim();

const getMentionMemberMeta = (member) => {
  const mentionTokenLabel = getMentionMemberTokenLabel(member).toLowerCase();

  return [member?.employeeCode, member?.email, member?.displayName]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .find((value) => value.toLowerCase() !== mentionTokenLabel);
};

const buildMentionSearchLabel = (member) =>
  [member?.employeeName, member?.displayName, member?.employeeCode, member?.email]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const getMentionSeedsFromMessage = (message) =>
  (Array.isArray(message?.mentionEmployees) ? message.mentionEmployees : []).map((member) => ({
    id: member._id,
    name: getMentionMemberTokenLabel(member),
  }));

const getChatAssetUrl = (value) => {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) return "";
  if (/^https?:\/\//i.test(normalizedValue)) return normalizedValue;

  const apiBaseUrl = String(api.defaults.baseURL || "").trim();
  const publicBaseUrl = apiBaseUrl.replace(/\/api\/?$/i, "/");

  try {
    return new URL(normalizedValue.replace(/^\//, ""), publicBaseUrl).toString();
  } catch {
    return normalizedValue;
  }
};

const formatAttachmentSize = (value) => {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const AUDIO_MIME_TYPE_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
];

const getSupportedAudioMimeType = () => {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") {
    return "";
  }

  return (
    AUDIO_MIME_TYPE_CANDIDATES.find((mimeType) =>
      window.MediaRecorder.isTypeSupported(mimeType)
    ) || ""
  );
};

const isAudioMimeType = (value) => String(value || "").trim().toLowerCase().startsWith("audio/");

const getAudioFileExtension = (mimeType) => {
  const normalizedType = String(mimeType || "").toLowerCase();
  if (normalizedType.includes("mp4") || normalizedType.includes("aac")) return "m4a";
  if (normalizedType.includes("mpeg")) return "mp3";
  if (normalizedType.includes("ogg")) return "ogg";
  if (normalizedType.includes("wav")) return "wav";
  return "webm";
};

const formatRecordingDuration = (value) => {
  const totalSeconds = Math.max(0, Number(value || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const getInitials = (value, fallback = "CH") =>
  String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || fallback;

const getGroupScopeLabel = (group, fallback = "Group") =>
  group?.scopeDisplayName ||
  group?.departmentDisplayName ||
  group?.siteDisplayName ||
  group?.scopeName ||
  group?.departmentName ||
  group?.siteName ||
  fallback;

const renderMentionedMessage = (message, mentionNames, highlighted) => {
  const content = String(message || "");
  const mentionTokens = [...new Set((Array.isArray(mentionNames) ? mentionNames : []).filter(Boolean))]
    .map((name) => `@${String(name).trim()}`)
    .filter(Boolean);

  if (!mentionTokens.length) {
    return content;
  }

  const pattern = new RegExp(`(${mentionTokens.map((item) => escapeRegex(item)).join("|")})`, "gi");
  const tokenSet = new Set(mentionTokens.map((item) => item.toLowerCase()));

  return content.split(pattern).map((part, index) => {
    if (!tokenSet.has(String(part || "").toLowerCase())) {
      return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
    }

    return (
      <span
        key={`${part}-${index}`}
        className={`chat-mention-token${highlighted ? " chat-mention-token--accent" : ""}`}
      >
        {part}
      </span>
    );
  });
};

export default function ChatModule({ chatType = "site", apiBasePath = "/chat" }) {
  const user = getUser();
  const isEmployee = String(user?.role || "").trim().toLowerCase() === "employee";
  const isDepartmentChat = String(chatType || "").trim().toLowerCase() === "department";
  const chatConfig = isDepartmentChat
    ? {
        title: "Department Chat",
        intro:
          "Use department chat for task status updates, blockers, escalations, and follow-ups. Employees only see their assigned department groups, department heads can access their team conversations, and admin can monitor every department.",
        accentLabel: "Department coordination lane",
        groupSearchPlaceholder: "Search by department or employee",
        groupListTitle: "Department Groups",
        groupScopeFallback: "Department",
        loadingGroupsText: "Loading department chats...",
        emptyGroupsText: "No department chat groups match this filter.",
        noMessagesText: "No messages found for this department chat yet.",
        emptyAccessText: "No department chat is available for this account right now.",
        mentionHelpText: "Use @ to mention teammates in this department group.",
        composerTitle: "Share with this department group",
        deleteConfirmText: "Delete this message from the department chat?",
        loadGroupsError: "Unable to load department chats.",
      }
    : {
        title: "Site Chat",
        intro:
          "Use site chat for task status updates, blockers, escalations, and follow-ups. Employees only see their assigned site groups, site heads can access their site conversations, and admin can monitor every site.",
        accentLabel: "Site coordination lane",
        groupSearchPlaceholder: "Search by site, company, or employee",
        groupListTitle: "Site Groups",
        groupScopeFallback: "Site",
        loadingGroupsText: "Loading site chats...",
        emptyGroupsText: "No site chat groups match this filter.",
        noMessagesText: "No messages found for this site chat yet.",
        emptyAccessText: "No site chat is available for this account right now.",
        mentionHelpText: "Use @ to mention teammates in this site group.",
        composerTitle: "Share with this site group",
        deleteConfirmText: "Delete this message from the site chat?",
        loadGroupsError: "Unable to load site chats.",
      };
  const [searchParams, setSearchParams] = useSearchParams();
  const textareaRef = useRef(null);
  const editTextareaRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingCancelRef = useRef(false);
  const recordingTimerRef = useRef(null);
  const selectedGroupIdRef = useRef("");
  const loadGroupsRef = useRef(async () => {});
  const loadMessagesRef = useRef(async () => {});
  const loadNotificationsRef = useRef(async () => {});

  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(() => searchParams.get("group") || "");
  const [messages, setMessages] = useState([]);
  const [mentionNotifications, setMentionNotifications] = useState([]);
  const [groupSearch, setGroupSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [messageSearch, setMessageSearch] = useState("");
  const [composerMessage, setComposerMessage] = useState("");
  const [composerAttachmentFile, setComposerAttachmentFile] = useState(null);
  const [composerAttachmentPreviewUrl, setComposerAttachmentPreviewUrl] = useState("");
  const [recordingState, setRecordingState] = useState("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [selectedMentions, setSelectedMentions] = useState([]);
  const [mentionContext, setMentionContext] = useState(null);
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editingMessageText, setEditingMessageText] = useState("");
  const [editingMentions, setEditingMentions] = useState([]);
  const [editingMentionContext, setEditingMentionContext] = useState(null);
  const [editingMentionActiveIndex, setEditingMentionActiveIndex] = useState(0);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [updatingMessageId, setUpdatingMessageId] = useState("");
  const [deletingMessageId, setDeletingMessageId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const deferredGroupSearch = useDeferredValue(groupSearch);
  const deferredMessageSearch = useDeferredValue(messageSearch);
  const highlightedMessageId = searchParams.get("message") || "";
  const queryGroupId = searchParams.get("group") || "";
  const canSendComposerMessage = Boolean(
    (String(composerMessage || "").trim() || composerAttachmentFile) &&
      recordingState === "idle"
  );
  const isComposerAttachmentImage = String(composerAttachmentFile?.type || "")
    .trim()
    .toLowerCase()
    .startsWith("image/");
  const isComposerAttachmentAudio = isAudioMimeType(composerAttachmentFile?.type);
  const composerAttachmentStatus = isComposerAttachmentAudio
    ? "Voice ready"
    : composerAttachmentFile
    ? "1 file attached"
    : "No file";
  const supportsVoiceRecording =
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  selectedGroupIdRef.current = selectedGroupId;

  const loadGroups = async (showLoader = true) => {
    if (showLoader) {
      setGroupsLoading(true);
    }

    try {
      const response = await api.get(`${apiBasePath}/groups`);
      const nextGroups = Array.isArray(response.data?.groups) ? response.data.groups : [];

      setGroups(nextGroups);
      setErrorMessage("");
      setSelectedGroupId((currentValue) => {
        const nextIds = new Set(nextGroups.map((row) => String(row._id)));
        const requestedGroupId = String(queryGroupId || "").trim();

        if (requestedGroupId && nextIds.has(requestedGroupId)) {
          return requestedGroupId;
        }

        if (currentValue && nextIds.has(String(currentValue))) {
          return currentValue;
        }

        return nextGroups[0]?._id || "";
      });
    } catch (err) {
      console.error("Chat groups load failed:", err);
      setGroups([]);
      setErrorMessage(err.response?.data?.message || chatConfig.loadGroupsError);
    } finally {
      if (showLoader) {
        setGroupsLoading(false);
      }
    }
  };

  const loadMessages = async (groupId, showLoader = true) => {
    const normalizedGroupId = String(groupId || "").trim();

    if (!normalizedGroupId) {
      setMessages([]);
      return;
    }

    if (showLoader) {
      setMessagesLoading(true);
    }

    try {
      const response = await api.get(`${apiBasePath}/groups/${normalizedGroupId}/messages`, {
        params: {
          search: deferredMessageSearch || undefined,
        },
      });

      setMessages(Array.isArray(response.data?.messages) ? response.data.messages : []);

      await api.post(`${apiBasePath}/groups/${normalizedGroupId}/read`);
      void loadGroups(false);
      void loadNotifications(false);
    } catch (err) {
      console.error("Chat messages load failed:", err);
      setMessages([]);
      setErrorMessage(err.response?.data?.message || "Unable to load chat messages.");
    } finally {
      if (showLoader) {
        setMessagesLoading(false);
      }
    }
  };

  const loadNotifications = async (showLoader = true) => {
    if (!isEmployee) {
      setMentionNotifications([]);
      return;
    }

    if (showLoader) {
      setNotificationsLoading(true);
    }

    try {
      const response = await api.get(`${apiBasePath}/notifications`);
      setMentionNotifications(Array.isArray(response.data?.mentions) ? response.data.mentions : []);
    } catch (err) {
      console.error("Chat notifications load failed:", err);
      setMentionNotifications([]);
    } finally {
      if (showLoader) {
        setNotificationsLoading(false);
      }
    }
  };

  loadGroupsRef.current = loadGroups;
  loadMessagesRef.current = loadMessages;
  loadNotificationsRef.current = loadNotifications;

  useEffect(() => {
    void loadGroupsRef.current(true);
    void loadNotificationsRef.current(true);
  }, [apiBasePath]);

  useEffect(() => {
    if (!selectedGroupId) {
      setMessages([]);
      resetEditingState();
      return;
    }

    resetEditingState();
    void loadMessagesRef.current(selectedGroupId, true);
  }, [selectedGroupId, deferredMessageSearch]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      void loadNotificationsRef.current(false);
      void loadGroupsRef.current(false);
    }, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const baseUrl = String(api.defaults.baseURL || "").replace(/\/$/, "");

    if (!token || !baseUrl) {
      return undefined;
    }

    const eventSource = new EventSource(
      `${baseUrl}${apiBasePath}/stream?token=${encodeURIComponent(token)}`
    );

    const handleChatEvent = (event) => {
      try {
        const payload = JSON.parse(event.data || "{}");
        void loadGroupsRef.current(false);
        void loadNotificationsRef.current(false);

        if (
          String(payload?.groupId || "").trim() &&
          String(payload.groupId) === String(selectedGroupIdRef.current)
        ) {
          void loadMessagesRef.current(selectedGroupIdRef.current, false);
        }

        if (payload?.type === "presence" && selectedGroupIdRef.current) {
          void loadMessagesRef.current(selectedGroupIdRef.current, false);
        }
      } catch (err) {
        console.error("Chat stream parse failed:", err);
      }
    };

    eventSource.addEventListener("chat-event", handleChatEvent);

    return () => {
      eventSource.removeEventListener("chat-event", handleChatEvent);
      eventSource.close();
    };
  }, [apiBasePath]);

  useEffect(() => {
    if (!highlightedMessageId) return;
    if (!messages.some((row) => String(row._id) === String(highlightedMessageId))) return;

    const target = document.getElementById(`chat-message-${highlightedMessageId}`);
    if (!target) return;

    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [highlightedMessageId, messages]);

  useEffect(() => {
    if (!editingMessageId) return;
    if (messages.some((row) => String(row._id) === String(editingMessageId))) return;

    setEditingMessageId("");
    setEditingMessageText("");
    setEditingMentions([]);
    setEditingMentionContext(null);
  }, [editingMessageId, messages]);

  useEffect(() => {
    return () => {
      if (composerAttachmentPreviewUrl) {
        window.URL.revokeObjectURL(composerAttachmentPreviewUrl);
      }
    };
  }, [composerAttachmentPreviewUrl]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }

      if (mediaRecorderRef.current?.state === "recording") {
        recordingCancelRef.current = true;
        mediaRecorderRef.current.stop();
      }

      recordingStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const nextIds = new Set(groups.map((group) => String(group._id)));

    if (selectedGroupId && nextIds.has(String(selectedGroupId))) {
      return;
    }

    if (queryGroupId && nextIds.has(String(queryGroupId))) {
      setSelectedGroupId(queryGroupId);
      return;
    }

    if (groups.length) {
      setSelectedGroupId(String(groups[0]._id));
    }
  }, [groups, queryGroupId, selectedGroupId]);

  const companyOptions = useMemo(() => {
    const uniqueRows = [];
    const seen = new Set();

    groups.forEach((group) => {
      const companyName = String(group.companyName || "").trim();
      const companyKey = companyName || "__no_company__";
      if (seen.has(companyKey)) return;
      seen.add(companyKey);
      uniqueRows.push({
        companyKey,
        companyLabel: companyName || "No company",
      });
    });

    return uniqueRows;
  }, [groups]);

  const visibleGroups = useMemo(() => {
    const normalizedSearch = String(deferredGroupSearch || "").trim().toLowerCase();

    return groups.filter((group) => {
      const groupCompanyKey = String(group.companyName || "").trim() || "__no_company__";

      if (!isDepartmentChat && companyFilter !== "all" && groupCompanyKey !== String(companyFilter)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        group.name,
        group.scopeName,
        group.scopeDisplayName,
        group.siteName,
        group.siteDisplayName,
        group.departmentName,
        group.departmentDisplayName,
        group.companyName,
        ...(Array.isArray(group.members) ? group.members.map((member) => member.displayName) : []),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [companyFilter, deferredGroupSearch, groups, isDepartmentChat]);

  const selectedGroup =
    groups.find((group) => String(group._id) === String(selectedGroupId)) || null;
  const mentionSuggestions = useMemo(() => {
    if (!selectedGroup || !mentionContext) {
      return [];
    }

    const normalizedQuery = String(mentionContext.query || "").trim().toLowerCase();

    return (Array.isArray(selectedGroup.members) ? selectedGroup.members : [])
      .filter(
        (member) => !normalizedQuery || buildMentionSearchLabel(member).includes(normalizedQuery)
      );
  }, [mentionContext, selectedGroup]);
  const editingMentionSuggestions = useMemo(() => {
    if (!selectedGroup || !editingMentionContext) {
      return [];
    }

    const normalizedQuery = String(editingMentionContext.query || "").trim().toLowerCase();

    return (Array.isArray(selectedGroup.members) ? selectedGroup.members : [])
      .filter(
        (member) => !normalizedQuery || buildMentionSearchLabel(member).includes(normalizedQuery)
      );
  }, [editingMentionContext, selectedGroup]);

  const summary = useMemo(() => {
    return groups.reduce(
      (result, group) => {
        result.unreadMessages += Number(group.unreadCount || 0);
        result.unreadMentions += Number(group.unreadMentionCount || 0);
        return result;
      },
      {
        unreadMessages: 0,
        unreadMentions: 0,
      }
    );
  }, [groups]);

  const openGroup = (groupId, messageId = "") => {
    const normalizedGroupId = String(groupId || "").trim();
    if (!normalizedGroupId) return;

    setSelectedGroupId(normalizedGroupId);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("group", normalizedGroupId);

    if (messageId) {
      nextParams.set("message", String(messageId));
    } else {
      nextParams.delete("message");
    }

    setSearchParams(nextParams, { replace: true });
  };

  const handleComposerChange = (event) => {
    const nextValue = event.target.value;
    const nextCursor = event.target.selectionStart;

    setComposerMessage(nextValue);
    setSelectedMentions((currentMentions) =>
      currentMentions.filter((item) =>
        String(nextValue || "")
          .toLowerCase()
          .includes(`@${String(item.name || "").toLowerCase()}`)
      )
    );
    setMentionContext(getMentionContext(nextValue, nextCursor));
    setMentionActiveIndex(0);
  };

  const refreshMentionContext = () => {
    const target = textareaRef.current;
    if (!target) return;

    setMentionContext(getMentionContext(target.value, target.selectionStart));
    setMentionActiveIndex(0);
  };

  const resetEditingState = () => {
    setEditingMessageId("");
    setEditingMessageText("");
    setEditingMentions([]);
    setEditingMentionContext(null);
    setEditingMentionActiveIndex(0);
  };

  const clearComposerAttachment = () => {
    setComposerAttachmentFile(null);
    setComposerAttachmentPreviewUrl((currentValue) => {
      if (currentValue) {
        window.URL.revokeObjectURL(currentValue);
      }

      return "";
    });

    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  };

  const openAttachmentPicker = () => {
    attachmentInputRef.current?.click();
  };

  const clearVoiceRecordingResources = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    recordingStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    mediaRecorderRef.current = null;
  };

  const buildVoiceFileFromChunks = (chunks, mimeType) => {
    const resolvedMimeType =
      String(mimeType || chunks[0]?.type || "").split(";")[0] || "audio/webm";
    const audioBlob = new Blob(chunks, { type: resolvedMimeType });
    const extension = getAudioFileExtension(resolvedMimeType);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    return new File([audioBlob], `voice-message-${timestamp}.${extension}`, {
      type: resolvedMimeType,
    });
  };

  const attachRecordedVoice = (voiceFile) => {
    const validationMessage = validateFile(voiceFile, GENERAL_ATTACHMENT_OPTIONS);
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    setComposerAttachmentFile(voiceFile);
    setComposerAttachmentPreviewUrl((currentValue) => {
      if (currentValue) {
        window.URL.revokeObjectURL(currentValue);
      }

      return window.URL.createObjectURL(voiceFile);
    });
    setErrorMessage("");
  };

  const startVoiceRecording = async () => {
    if (!supportsVoiceRecording || recordingState !== "idle" || sending) {
      if (!supportsVoiceRecording) {
        setErrorMessage("Voice recording is not supported in this browser.");
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      clearComposerAttachment();
      const mimeType = getSupportedAudioMimeType();
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recordingChunksRef.current = [];
      recordingCancelRef.current = false;
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = () => {
        recordingCancelRef.current = true;
        setRecordingState("idle");
        setRecordingSeconds(0);
        clearVoiceRecordingResources();
        setErrorMessage("Voice recording failed. Please try again.");
      };

      mediaRecorder.onstop = () => {
        const chunks = recordingChunksRef.current;
        const wasCancelled = recordingCancelRef.current;
        const recordedMimeType = mediaRecorder.mimeType || mimeType;

        recordingChunksRef.current = [];
        recordingCancelRef.current = false;
        clearVoiceRecordingResources();
        setRecordingState("idle");
        setRecordingSeconds(0);

        if (wasCancelled) return;

        if (!chunks.length) {
          setErrorMessage("No voice audio was captured. Please try again.");
          return;
        }

        attachRecordedVoice(buildVoiceFileFromChunks(chunks, recordedMimeType));
      };

      mediaRecorder.start();
      setRecordingState("recording");
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((currentValue) => currentValue + 1);
      }, 1000);
      setErrorMessage("");
    } catch (err) {
      console.error("Voice recording start failed:", err);
      clearVoiceRecordingResources();
      setRecordingState("idle");
      setRecordingSeconds(0);
      setErrorMessage(
        err?.name === "NotAllowedError"
          ? "Microphone permission is required to record a voice message."
          : "Unable to start voice recording on this browser."
      );
    }
  };

  const stopVoiceRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    setRecordingState("processing");
    recorder.stop();
  };

  const cancelVoiceRecording = () => {
    const recorder = mediaRecorderRef.current;
    recordingCancelRef.current = true;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }

    clearVoiceRecordingResources();
    setRecordingState("idle");
    setRecordingSeconds(0);
  };

  const handleComposerAttachmentChange = (event) => {
    const nextFile = event.target.files?.[0];
    event.target.value = "";

    if (!nextFile) return;
    if (recordingState === "recording") {
      alert("Stop or cancel the voice recording before attaching a file.");
      return;
    }

    const validationMessage = validateFile(nextFile, GENERAL_ATTACHMENT_OPTIONS);
    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    setComposerAttachmentFile(nextFile);
    setComposerAttachmentPreviewUrl((currentValue) => {
      if (currentValue) {
        window.URL.revokeObjectURL(currentValue);
      }

      return window.URL.createObjectURL(nextFile);
    });
    setErrorMessage("");
  };

  const startEditingMessage = (message) => {
    setEditingMessageId(String(message?._id || ""));
    setEditingMessageText(String(message?.message || ""));
    setEditingMentions(getMentionSeedsFromMessage(message));
    setEditingMentionContext(null);
    setEditingMentionActiveIndex(0);
    setMentionContext(null);
    setMentionActiveIndex(0);

    requestAnimationFrame(() => {
      if (!editTextareaRef.current) return;
      editTextareaRef.current.focus();
      const valueLength = String(message?.message || "").length;
      editTextareaRef.current.setSelectionRange(valueLength, valueLength);
    });
  };

  const handleEditChange = (event) => {
    const nextValue = event.target.value;
    const nextCursor = event.target.selectionStart;

    setEditingMessageText(nextValue);
    setEditingMentions((currentMentions) =>
      currentMentions.filter((item) =>
        String(nextValue || "")
          .toLowerCase()
          .includes(`@${String(item.name || "").toLowerCase()}`)
      )
    );
    setEditingMentionContext(getMentionContext(nextValue, nextCursor));
    setEditingMentionActiveIndex(0);
  };

  const refreshEditMentionContext = () => {
    const target = editTextareaRef.current;
    if (!target) return;

    setEditingMentionContext(getMentionContext(target.value, target.selectionStart));
    setEditingMentionActiveIndex(0);
  };

  const selectMention = (member) => {
    if (!mentionContext) return;

    const mentionName = getMentionMemberTokenLabel(member);
    const mentionLabel = `@${mentionName}`;
    const nextMessage =
      composerMessage.slice(0, mentionContext.start) +
      mentionLabel +
      " " +
      composerMessage.slice(mentionContext.end);

    setComposerMessage(nextMessage);
    setSelectedMentions((currentMentions) => {
      const alreadySelected = currentMentions.some(
        (item) => String(item.id) === String(member._id)
      );

      if (alreadySelected) {
        return currentMentions;
      }

      return [
        ...currentMentions,
        {
          id: member._id,
          name: mentionName,
        },
      ];
    });
    setMentionContext(null);
    setMentionActiveIndex(0);

    requestAnimationFrame(() => {
      if (!textareaRef.current) return;

      const nextCursor = mentionContext.start + mentionLabel.length + 1;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const selectEditMention = (member) => {
    if (!editingMentionContext) return;

    const mentionName = getMentionMemberTokenLabel(member);
    const mentionLabel = `@${mentionName}`;
    const nextMessage =
      editingMessageText.slice(0, editingMentionContext.start) +
      mentionLabel +
      " " +
      editingMessageText.slice(editingMentionContext.end);

    setEditingMessageText(nextMessage);
    setEditingMentions((currentMentions) => {
      const alreadySelected = currentMentions.some(
        (item) => String(item.id) === String(member._id)
      );

      if (alreadySelected) {
        return currentMentions;
      }

      return [
        ...currentMentions,
        {
          id: member._id,
          name: mentionName,
        },
      ];
    });
    setEditingMentionContext(null);
    setEditingMentionActiveIndex(0);

    requestAnimationFrame(() => {
      if (!editTextareaRef.current) return;

      const nextCursor = editingMentionContext.start + mentionLabel.length + 1;
      editTextareaRef.current.focus();
      editTextareaRef.current.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const sendMessage = async () => {
    const normalizedMessage = String(composerMessage || "").trim();

    if (!selectedGroup || (!normalizedMessage && !composerAttachmentFile) || sending) {
      return;
    }

    setSending(true);

    try {
      const formData = new FormData();
      formData.append("message", normalizedMessage);
      formData.append(
        "mentionIds",
        JSON.stringify(getMentionIdsFromText(composerMessage, selectedMentions))
      );

      if (composerAttachmentFile) {
        formData.append("attachment", composerAttachmentFile);
      }

      await api.post(`${apiBasePath}/groups/${selectedGroup._id}/messages`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setComposerMessage("");
      clearComposerAttachment();
      setSelectedMentions([]);
      setMentionContext(null);
      setMessageSearch("");
      setErrorMessage("");

      await loadMessages(selectedGroup._id, false);
      await loadGroups(false);
      await loadNotifications(false);
    } catch (err) {
      console.error("Chat send failed:", err);
      setErrorMessage(err.response?.data?.message || "Unable to send chat message.");
    } finally {
      setSending(false);
    }
  };

  const saveEditedMessage = async (message) => {
    const normalizedMessage = String(editingMessageText || "").trim();

    if (
      !selectedGroup ||
      !message?._id ||
      (!normalizedMessage && !message?.attachment?.url && !message?.image?.url) ||
      updatingMessageId
    ) {
      return;
    }

    setUpdatingMessageId(String(message._id));

    try {
      await api.patch(`${apiBasePath}/groups/${selectedGroup._id}/messages/${message._id}`, {
        message: normalizedMessage,
        mentionIds: getMentionIdsFromText(editingMessageText, editingMentions),
      });

      resetEditingState();
      setErrorMessage("");

      await loadMessages(selectedGroup._id, false);
      await loadGroups(false);
      await loadNotifications(false);
    } catch (err) {
      console.error("Chat update failed:", err);
      setErrorMessage(err.response?.data?.message || "Unable to update chat message.");
    } finally {
      setUpdatingMessageId("");
    }
  };

  const deleteMessage = async (message) => {
    if (!selectedGroup || !message?._id || deletingMessageId) {
      return;
    }

    const confirmed = window.confirm(chatConfig.deleteConfirmText);

    if (!confirmed) {
      return;
    }

    setDeletingMessageId(String(message._id));

    try {
      await api.delete(`${apiBasePath}/groups/${selectedGroup._id}/messages/${message._id}`);

      if (String(editingMessageId) === String(message._id)) {
        resetEditingState();
      }

      if (String(highlightedMessageId) === String(message._id)) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("message");
        setSearchParams(nextParams, { replace: true });
      }

      setErrorMessage("");

      await loadMessages(selectedGroup._id, false);
      await loadGroups(false);
      await loadNotifications(false);
    } catch (err) {
      console.error("Chat delete failed:", err);
      setErrorMessage(err.response?.data?.message || "Unable to delete chat message.");
    } finally {
      setDeletingMessageId("");
    }
  };

  const handleComposerKeyDown = (event) => {
    if (mentionContext && mentionSuggestions.length) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionActiveIndex((currentIndex) =>
          currentIndex >= mentionSuggestions.length - 1 ? 0 : currentIndex + 1
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionActiveIndex((currentIndex) =>
          currentIndex <= 0 ? mentionSuggestions.length - 1 : currentIndex - 1
        );
        return;
      }

      if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
        event.preventDefault();
        selectMention(mentionSuggestions[mentionActiveIndex] || mentionSuggestions[0]);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setMentionContext(null);
      setMentionActiveIndex(0);
    }
  };

  const handleEditKeyDown = (event, message) => {
    if (editingMentionContext && editingMentionSuggestions.length) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setEditingMentionActiveIndex((currentIndex) =>
          currentIndex >= editingMentionSuggestions.length - 1 ? 0 : currentIndex + 1
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setEditingMentionActiveIndex((currentIndex) =>
          currentIndex <= 0 ? editingMentionSuggestions.length - 1 : currentIndex - 1
        );
        return;
      }

      if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
        event.preventDefault();
        selectEditMention(
          editingMentionSuggestions[editingMentionActiveIndex] || editingMentionSuggestions[0]
        );
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void saveEditedMessage(message);
    }

    if (event.key === "Escape") {
      if (editingMentionContext) {
        event.preventDefault();
        setEditingMentionContext(null);
        setEditingMentionActiveIndex(0);
        return;
      }

      resetEditingState();
    }
  };

  const renderMentionSuggestion = (member, isActive, onSelect) => {
    const mentionTitle = getMentionMemberTitle(member);
    const mentionMeta = getMentionMemberMeta(member);

    return (
      <button
        key={member._id}
        type="button"
        className={`chat-mention-menu__item${isActive ? " chat-mention-menu__item--active" : ""}`}
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onClick={() => onSelect(member)}
      >
        <span className="chat-mention-menu__avatar">{getInitials(mentionTitle, "EM")}</span>
        <span className="chat-mention-menu__content">
          <span className="chat-mention-menu__title">{mentionTitle}</span>
          <span className="chat-mention-menu__meta">{mentionMeta || "Employee"}</span>
        </span>
      </button>
    );
  };

  const onlineCount = Array.isArray(selectedGroup?.members)
    ? selectedGroup.members.filter((member) => member.isOnline).length
    : 0;
  const selectedGroupScopeLabel = getGroupScopeLabel(
    selectedGroup,
    chatConfig.groupScopeFallback
  );
  const selectedGroupMemberCount = Array.isArray(selectedGroup?.members)
    ? selectedGroup.members.length
    : 0;
  const selectedGroupUnreadCount = Number(selectedGroup?.unreadCount || 0);
  const selectedGroupMentionCount = Number(selectedGroup?.unreadMentionCount || 0);

  return (
    <div
      className={`container py-4 pb-5 chat-page ${
        isDepartmentChat ? "chat-page--department" : "chat-page--site"
      }`}
    >
      <div className="page-intro-card mb-4 chat-hero-card">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-4">
          <div>
            <div className="page-kicker">Task Communication</div>
            <div className="chat-hero-card__label">{chatConfig.accentLabel}</div>
            <h2 className="mb-2">{chatConfig.title}</h2>
            <p className="page-subtitle mb-0">{chatConfig.intro}</p>
          </div>

          <div className="chat-hero-stats">
            <div className="chat-hero-stat">
              <div className="chat-hero-stat__label">Groups</div>
              <div className="chat-hero-stat__value">{groups.length}</div>
            </div>
            <div className="chat-hero-stat">
              <div className="chat-hero-stat__label">Unread Messages</div>
              <div className="chat-hero-stat__value">{summary.unreadMessages}</div>
            </div>
            <div className="chat-hero-stat">
              <div className="chat-hero-stat__label">Unread Mentions</div>
              <div className="chat-hero-stat__value">{summary.unreadMentions}</div>
            </div>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="alert alert-warning" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <div className="row g-4 align-items-start">
        <div className="col-xl-4">
          <div className="soft-card chat-sidebar-card">
            <div className="chat-panel-heading">
              <div>
                <div className="chat-panel-heading__eyebrow">Navigator</div>
                <div className="fw-semibold">{chatConfig.groupListTitle}</div>
                <div className="form-help">
                  Filter conversations, unread queues, and mentions in one place.
                </div>
              </div>
              <span className="chat-panel-heading__count">{visibleGroups.length}</span>
            </div>

            <div className="d-flex flex-column gap-3">
              <div>
                <label className="form-label fw-semibold">Search Groups</label>
                <input
                  type="search"
                  className="form-control"
                  value={groupSearch}
                  onChange={(event) => setGroupSearch(event.target.value)}
                  placeholder={chatConfig.groupSearchPlaceholder}
                />
              </div>

              {!isDepartmentChat ? (
                <div>
                  <label className="form-label fw-semibold">Company Filter</label>
                  <select
                    className="form-select"
                    value={companyFilter}
                    onChange={(event) => setCompanyFilter(event.target.value)}
                  >
                    <option value="all">All accessible companies</option>
                    {companyOptions.map((option) => (
                      <option key={option.companyKey} value={option.companyKey}>
                        {option.companyLabel}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {isEmployee ? (
                <div className="chat-mentions-panel">
                  <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                    <div>
                      <div className="chat-panel-heading__eyebrow">Attention</div>
                      <div className="fw-semibold">Recent Mentions</div>
                    </div>
                    <span className="badge text-bg-primary">{mentionNotifications.length}</span>
                  </div>

                  {notificationsLoading ? (
                    <div className="small text-muted">Loading mention notifications...</div>
                  ) : mentionNotifications.length ? (
                    <div className="d-flex flex-column gap-2">
                      {mentionNotifications.slice(0, 5).map((notification) => (
                        <button
                          key={notification._id}
                          type="button"
                          className="notification-item"
                          onClick={() => openGroup(notification.groupId, notification._id)}
                        >
                          <div className="fw-semibold text-dark">
                            {notification.senderName || "Teammate"}
                          </div>
                          <div className="small text-muted text-start">
                            {buildChatMentionNotificationBody(notification)}
                          </div>
                          <div className="small text-primary text-start">
                            {formatChatDateTime(notification.createdAt)}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="small text-muted">
                      No unread mentions right now.
                    </div>
                  )}
                </div>
              ) : null}

              <div className="chat-group-list">
                {groupsLoading ? (
                  <div className="small text-muted">{chatConfig.loadingGroupsText}</div>
                ) : visibleGroups.length ? (
                  <div className="d-flex flex-column gap-2">
                    {visibleGroups.map((group) => (
                      <button
                        key={group._id}
                        type="button"
                        className={`chat-group-item${
                          String(group._id) === String(selectedGroupId)
                            ? " chat-group-item--active"
                            : ""
                        }`}
                        onClick={() => openGroup(group._id)}
                      >
                        <div className="d-flex justify-content-between align-items-start gap-3">
                          <div className="d-flex align-items-start gap-3 text-start">
                            <div className="chat-group-item__avatar">
                              {getInitials(
                                group.name,
                                getInitials(chatConfig.groupScopeFallback)
                              )}
                            </div>
                            <div className="chat-group-item__content">
                              <div className="fw-semibold text-dark">{group.name}</div>
                              <div className="small text-muted">
                                {getGroupScopeLabel(group, chatConfig.groupScopeFallback)}
                              </div>
                            </div>
                          </div> 
                          {group.unreadCount ? (
                            <span className="badge rounded-pill text-bg-primary">
                              {group.unreadCount}
                            </span>
                          ) : null}
                        </div>

                        <div className="chat-group-item__preview">
                          {group.lastMessagePreview || "No task discussion yet."}
                        </div>

                        <div className="chat-group-item__meta">
                          <span className="chat-inline-pill">{group.members.length} members</span>
                          <span className="chat-inline-pill">
                            {group.members.filter((member) => member.isOnline).length} online
                          </span>
                          {!isDepartmentChat && group.companyName ? (
                            <span className="chat-inline-pill">{group.companyName}</span>
                          ) : null}
                          {group.unreadMentionCount ? (
                            <span className="chat-inline-pill chat-inline-pill--warning">
                              {group.unreadMentionCount} mentions
                            </span>
                          ) : null}
                        </div>
                      </button>
                    ))} 
                  </div>
                ) : (
                  <div className="empty-state py-4">
                    {chatConfig.emptyGroupsText}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-8">
          <div className="soft-card chat-thread-card">
            {selectedGroup ? (
              <div className="d-flex flex-column gap-3">
                <div className="chat-thread-header">
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                    <div>
                      <div className="chat-panel-heading__eyebrow">
                        {selectedGroupScopeLabel}
                      </div>
                      <h3 className="mb-1">{selectedGroup.name}</h3>
                      <div className="page-subtitle">
                        {selectedGroupScopeLabel} | {selectedGroupMemberCount} members |{" "}
                        {onlineCount} online
                      </div>
                    </div>

                    <div className="chat-thread-metrics">
                      <div className="chat-thread-metric">
                        <span className="chat-thread-metric__label">Members</span>
                        <span className="chat-thread-metric__value">
                          {selectedGroupMemberCount}
                        </span>
                      </div>
                      <div className="chat-thread-metric">
                        <span className="chat-thread-metric__label">Unread</span>
                        <span className="chat-thread-metric__value">
                          {selectedGroupUnreadCount}
                        </span>
                      </div>
                      <div className="chat-thread-metric">
                        <span className="chat-thread-metric__label">Mentions</span>
                        <span className="chat-thread-metric__value">
                          {selectedGroupMentionCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="chat-member-strip">
                    {selectedGroup.members.slice(0, 6).map((member) => (
                      <span key={member._id} className="chat-member-chip">
                        <span
                          className={`chat-member-chip__status${
                            member.isOnline ? " chat-member-chip__status--online" : ""
                          }`}
                        />
                        {member.employeeName}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="chat-thread-toolbar">
                  <div className="small text-muted">
                    Search messages by content or employee name.
                  </div>
                  <div className="chat-thread-search">
                    <input
                      type="search"
                      className="form-control"
                      value={messageSearch}
                      onChange={(event) => setMessageSearch(event.target.value)}
                      placeholder="Search in this group"
                    />
                  </div>
                </div>

                <div className="chat-message-panel">
                  {messagesLoading ? (
                    <div className="empty-state py-5">Loading messages...</div>
                  ) : messages.length ? (
                    <div className="d-flex flex-column gap-3">
                      {messages.map((message) => {
                        const isHighlighted = String(message._id) === String(highlightedMessageId);
                        const isEditing = String(editingMessageId) === String(message._id);
                        const isUpdating = String(updatingMessageId) === String(message._id);
                        const isDeleting = String(deletingMessageId) === String(message._id);

                        return (
                          <div
                            key={message._id}
                            id={`chat-message-${message._id}`}
                            className={`chat-message${
                              message.isOwnMessage ? " chat-message--own" : ""
                            }${isHighlighted ? " chat-message--highlighted" : ""}`}
                          >
                            <div className="chat-message__header">
                              <div className="chat-message__sender">
                                <span
                                  className={`chat-message__avatar${
                                    message.isOwnMessage ? " chat-message__avatar--own" : ""
                                  }`}
                                >
                                  {getInitials(message.senderName, "TM")}
                                </span>
                                <div>
                                  <div className="fw-semibold">{message.senderName}</div>
                                  <div className="small text-muted d-flex flex-wrap gap-2 align-items-center">
                                    <span>{formatChatDateTime(message.createdAt)}</span>
                                    {message.isEdited ? <span>Edited</span> : null}
                                  </div>
                                </div>
                              </div>
                              <div className="chat-message__actions">
                                {message.isOwnMessage ? (
                                  <span className="chat-inline-pill chat-inline-pill--subtle">
                                    You
                                  </span>
                                ) : null}
                                {message.isOwnMessage ? (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm chat-message__action"
                                      onClick={() => startEditingMessage(message)}
                                      disabled={
                                        isDeleting ||
                                        isUpdating ||
                                        Boolean(editingMessageId && !isEditing)
                                      }
                                    >
                                      {isEditing ? "Editing" : "Edit"}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm chat-message__action chat-message__action--danger"
                                      onClick={() => {
                                        void deleteMessage(message);
                                      }}
                                      disabled={isDeleting || isUpdating}
                                    >
                                      {isDeleting ? "Deleting..." : "Delete"}
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </div>

                            {isEditing ? (
                              <div className="chat-message__editor">
                                <div
                                  className={`chat-mention-layout${
                                    editingMentionContext ? " chat-mention-layout--open" : ""
                                  }`}
                                >
                                  <div className="position-relative">
                                    <textarea
                                      ref={editTextareaRef}
                                      rows={4}
                                      className="form-control"
                                      value={editingMessageText}
                                      onChange={handleEditChange}
                                      onClick={refreshEditMentionContext}
                                      onKeyUp={refreshEditMentionContext}
                                      onKeyDown={(event) => handleEditKeyDown(event, message)}
                                      placeholder="Update your task-related message..."
                                    />
                                  </div>

                                  {editingMentionContext ? (
                                    <div className="chat-mention-menu chat-mention-menu--side">
                                      <div className="chat-mention-menu__hint">
                                        Mention an employee
                                      </div>
                                      {editingMentionSuggestions.length ? (
                                        <div className="chat-mention-menu__results">
                                          {editingMentionSuggestions.map((member, index) =>
                                            renderMentionSuggestion(
                                              member,
                                              index === editingMentionActiveIndex,
                                              selectEditMention
                                            )
                                          )}
                                        </div>
                                      ) : (
                                        <div className="chat-mention-menu__empty">
                                          No matching employee found.
                                        </div>
                                      )}
                                    </div>
                                  ) : null}
                                </div>

                                {editingMentions.length ? (
                                  <div className="d-flex flex-wrap gap-2 mt-3">
                                    {editingMentions.map((mention) => (
                                      <span
                                        key={mention.id}
                                        className="chat-message__mention-pill"
                                      >
                                        @{mention.name}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}

                                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mt-3">
                                  <div className="small text-muted">
                                    Press Enter to save. Use Shift+Enter for a new line.
                                  </div>
                                  <div className="d-flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      className="btn btn-outline-secondary btn-sm"
                                      onClick={resetEditingState}
                                      disabled={isUpdating}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-sm"
                                      onClick={() => {
                                        void saveEditedMessage(message);
                                      }}
                                      disabled={
                                        (!editingMessageText.trim() &&
                                          !message.attachment?.url &&
                                          !message.image?.url) ||
                                        isUpdating
                                      }
                                    >
                                      {isUpdating ? "Saving..." : "Save"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
                                {message.attachment?.isAudio && message.attachment?.url ? (
                                  <div className="chat-message__attachment chat-message__attachment--audio">
                                    <div className="chat-message__file-icon">VOICE</div>
                                    <div className="chat-message__attachment-meta">
                                      <div className="fw-semibold text-dark text-break">
                                        {message.attachment.originalName || "Voice message"}
                                      </div>
                                      <audio
                                        controls
                                        preload="metadata"
                                        src={getChatAssetUrl(message.attachment.url)}
                                        className="chat-message__audio"
                                      >
                                        Your browser does not support audio playback.
                                      </audio>
                                      <div className="small text-muted">
                                        {[message.attachment.mimeType, formatAttachmentSize(message.attachment.size)]
                                          .filter(Boolean)
                                          .join(" | ") || "Audio attachment"}
                                      </div>
                                    </div>
                                  </div>
                                ) : message.image?.url ? (
                                  <a
                                    href={getChatAssetUrl(message.image.url)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="chat-message__attachment chat-message__attachment--image"
                                  >
                                    <img
                                      src={getChatAssetUrl(message.image.url)}
                                      alt={message.image.originalName || "Chat upload"}
                                      className="chat-message__image"
                                    />
                                    <div className="chat-message__attachment-meta">
                                      <div className="fw-semibold text-dark">
                                        {message.image.originalName || "Image attachment"}
                                      </div>
                                      <div className="small text-muted">
                                        {formatAttachmentSize(message.image.size) || "Image"}
                                      </div>
                                    </div>
                                  </a>
                                ) : message.attachment?.url ? (
                                  <a
                                    href={getChatAssetUrl(message.attachment.url)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="chat-message__attachment"
                                  >
                                    <div className="chat-message__file-icon">FILE</div>
                                    <div className="chat-message__attachment-meta">
                                      <div className="fw-semibold text-dark text-break">
                                        {message.attachment.originalName || "Attached file"}
                                      </div>
                                      <div className="small text-muted">
                                        {[message.attachment.mimeType, formatAttachmentSize(message.attachment.size)]
                                          .filter(Boolean)
                                          .join(" | ") || "File attachment"}
                                      </div>
                                    </div>
                                  </a>
                                ) : null}

                                {message.message ? (
                                  <div className="chat-message__body">
                                    {renderMentionedMessage(
                                      message.message,
                                      message.mentionNames,
                                      isHighlighted
                                    )}
                                  </div>
                                ) : null}

                                {message.mentionEmployees.length ? (
                                  <div className="chat-message__mentions">
                                    {message.mentionEmployees.map((member) => (
                                      <span
                                        key={member._id}
                                        className="chat-message__mention-pill"
                                      >
                                        @{member.employeeName}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state py-5">
                      {chatConfig.noMessagesText}
                    </div>
                  )}
                </div>

                <div className="chat-composer">
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    className="d-none"
                    accept={GENERAL_ATTACHMENT_ACCEPT}
                    onChange={handleComposerAttachmentChange}
                  />
                  <div className="chat-composer__header">
                    <div>
                      <div className="chat-panel-heading__eyebrow">Compose</div>
                      <div className="fw-semibold">{chatConfig.composerTitle}</div>
                    </div>
                    <div className="chat-composer__status">
                      <span className="chat-inline-pill">
                        {selectedMentions.length} mentions
                      </span>
                      <span className="chat-inline-pill">
                        {composerAttachmentStatus}
                      </span>
                    </div>
                  </div>
                  <div className="small text-muted mb-2">
                    {chatConfig.mentionHelpText} You can also attach one file or record a voice message.
                  </div>
                  <div
                    className={`chat-mention-layout${
                      mentionContext ? " chat-mention-layout--open" : ""
                    }`}
                  >
                    <div className="position-relative">
                      <textarea
                        ref={textareaRef}
                        rows={4}
                        className="form-control"
                        value={composerMessage}
                        onChange={handleComposerChange}
                        onClick={refreshMentionContext}
                        onKeyUp={refreshMentionContext}
                        onKeyDown={handleComposerKeyDown}
                        placeholder="Share work status, pending items, or clarifications..."
                      />
                    </div>

                    {mentionContext ? (
                      <div className="chat-mention-menu chat-mention-menu--side">
                        <div className="chat-mention-menu__hint">Mention an employee</div>
                        {mentionSuggestions.length ? (
                          <div className="chat-mention-menu__results">
                            {mentionSuggestions.map((member, index) =>
                              renderMentionSuggestion(
                                member,
                                index === mentionActiveIndex,
                                selectMention
                              )
                            )}
                          </div>
                        ) : (
                          <div className="chat-mention-menu__empty">
                            No matching employee found.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {composerAttachmentPreviewUrl ? (
                    <div className="chat-image-preview-card mt-3">
                      {isComposerAttachmentImage ? (
                        <img
                          src={composerAttachmentPreviewUrl}
                          alt={composerAttachmentFile?.name || "Selected chat upload"}
                          className="chat-image-preview-card__image"
                        />
                      ) : isComposerAttachmentAudio ? (
                        <div className="chat-image-preview-card__file chat-image-preview-card__file--audio">
                          <div className="chat-message__file-icon">VOICE</div>
                          <div className="chat-message__attachment-meta">
                            <div className="fw-semibold text-dark text-break">
                              {composerAttachmentFile?.name || "Voice message"}
                            </div>
                            <audio
                              controls
                              preload="metadata"
                              src={composerAttachmentPreviewUrl}
                              className="chat-message__audio"
                            >
                              Your browser does not support audio playback.
                            </audio>
                            <div className="small text-muted">
                              {formatAttachmentSize(composerAttachmentFile?.size) || "Audio"}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="chat-image-preview-card__file">
                          <div className="chat-message__file-icon">FILE</div>
                          <div className="chat-message__attachment-meta">
                            <div className="fw-semibold text-dark text-break">
                              {composerAttachmentFile?.name || "Selected file"}
                            </div>
                            <div className="small text-muted">
                              {[
                                composerAttachmentFile?.type,
                                formatAttachmentSize(composerAttachmentFile?.size),
                              ]
                                .filter(Boolean)
                                .join(" | ") || "File attachment"}
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                        <div className="small text-muted">
                          {composerAttachmentFile?.name || "Selected file"}
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={clearComposerAttachment}
                        >
                          Remove File
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {selectedMentions.length ? (
                    <div className="d-flex flex-wrap gap-2 mt-3">
                      {selectedMentions.map((mention) => (
                        <span key={mention.id} className="chat-message__mention-pill">
                          @{mention.name}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mt-3">
                    <div className="small text-muted">
                      Press Enter to send. Use Shift+Enter for a new line.
                    </div>

                    <div className="chat-composer__actions">
                      {recordingState === "recording" ? (
                        <>
                          <span className="chat-voice-recorder__status" aria-live="polite">
                            Recording {formatRecordingDuration(recordingSeconds)}
                          </span>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={stopVoiceRecording}
                            disabled={sending}
                          >
                            Stop
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={cancelVoiceRecording}
                            disabled={sending}
                          >
                            Cancel Voice
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline-primary"
                          onClick={() => {
                            void startVoiceRecording();
                          }}
                          disabled={!supportsVoiceRecording || sending || recordingState === "processing"}
                          title={
                            supportsVoiceRecording
                              ? "Record voice message"
                              : "Voice recording is not supported in this browser"
                          }
                        >
                          {recordingState === "processing" ? "Processing Voice..." : "Record Voice"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-outline-primary"
                        onClick={openAttachmentPicker}
                        disabled={sending || recordingState !== "idle"}
                      >
                        {composerAttachmentFile ? "Change File" : "Add File"}
                      </button>
                      <Link to="/checklists" className="btn btn-outline-secondary">
                        Back to Tasks
                      </Link>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          void sendMessage();
                        }}
                        disabled={!canSendComposerMessage || sending || recordingState !== "idle"}
                      >
                        {sending
                          ? "Sending..."
                          : composerAttachmentFile
                          ? "Send Update"
                          : "Send Message"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state py-5">
                {chatConfig.emptyAccessText}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
