const { verifyAuthToken } = require("../middleware/auth");

const normalizeString = (value) => String(value || "").trim();
const parseMultiValueField = (value) => {
  if (Array.isArray(value)) return value;

  const normalizedValue = normalizeString(value);
  if (!normalizedValue) return [];

  try {
    const parsedValue = JSON.parse(normalizedValue);
    return Array.isArray(parsedValue) ? parsedValue : [parsedValue];
  } catch {
    return [value];
  }
};

const getStatusCode = (err) => Number(err?.status) || 500;

const getTokenFromRequest = (req) => {
  const authHeader = normalizeString(req.headers.authorization);

  if (authHeader.startsWith("Bearer ")) {
    return normalizeString(authHeader.slice(7));
  }

  return normalizeString(req.query.token);
};

const sendSseEvent = (res, event, payload) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const createChatController = (chatService) => {
  const {
    listAccessibleGroups,
    getGroupMessages,
    sendMessageToGroup,
    updateGroupMessage,
    deleteGroupMessage,
    markGroupAsRead,
    getChatNotifications,
    getAccessibleGroupContexts,
    subscribeChatEvents,
    registerViewerPresence,
    unregisterViewerPresence,
  } = chatService;

  return {
    listGroups: async (req, res) => {
      try {
        const payload = await listAccessibleGroups(req.user, {
          search: req.query.search,
        });

        return res.json(payload);
      } catch (err) {
        console.error("CHAT LIST GROUPS ERROR:", err);
        return res.status(getStatusCode(err)).json({
          message: err.message || "Failed to load chat groups",
        });
      }
    },

    getMessages: async (req, res) => {
      try {
        const payload = await getGroupMessages(req.user, req.params.groupId, {
          search: req.query.search,
          limit: req.query.limit,
        });

        return res.json(payload);
      } catch (err) {
        console.error("CHAT GET MESSAGES ERROR:", err);
        return res.status(getStatusCode(err)).json({
          message: err.message || "Failed to load chat messages",
        });
      }
    },

    sendMessage: async (req, res) => {
      try {
        const uploadedFile =
          req.files?.attachment?.[0] ||
          req.files?.image?.[0] ||
          req.file ||
          null;

        const payload = await sendMessageToGroup(req.user, req.params.groupId, {
          message: req.body.message,
          mentionIds: parseMultiValueField(req.body.mentionIds),
          file: uploadedFile,
        });

        return res.status(201).json(payload);
      } catch (err) {
        console.error("CHAT SEND MESSAGE ERROR:", err);
        return res.status(getStatusCode(err)).json({
          message: err.message || "Failed to send chat message",
        });
      }
    },

    updateMessage: async (req, res) => {
      try {
        const payload = await updateGroupMessage(
          req.user,
          req.params.groupId,
          req.params.messageId,
          {
            message: req.body.message,
            mentionIds: parseMultiValueField(req.body.mentionIds),
          }
        );

        return res.json(payload);
      } catch (err) {
        console.error("CHAT UPDATE MESSAGE ERROR:", err);
        return res.status(getStatusCode(err)).json({
          message: err.message || "Failed to update chat message",
        });
      }
    },

    deleteMessage: async (req, res) => {
      try {
        const payload = await deleteGroupMessage(
          req.user,
          req.params.groupId,
          req.params.messageId
        );
        return res.json(payload);
      } catch (err) {
        console.error("CHAT DELETE MESSAGE ERROR:", err);
        return res.status(getStatusCode(err)).json({
          message: err.message || "Failed to delete chat message",
        });
      }
    },

    markRead: async (req, res) => {
      try {
        const payload = await markGroupAsRead(req.user, req.params.groupId);
        return res.json(payload);
      } catch (err) {
        console.error("CHAT MARK READ ERROR:", err);
        return res.status(getStatusCode(err)).json({
          message: err.message || "Failed to update chat read status",
        });
      }
    },

    getNotifications: async (req, res) => {
      try {
        const payload = await getChatNotifications(req.user, {
          limit: req.query.limit,
        });

        return res.json(payload);
      } catch (err) {
        console.error("CHAT NOTIFICATIONS ERROR:", err);
        return res.status(getStatusCode(err)).json({
          message: err.message || "Failed to load chat notifications",
        });
      }
    },

    stream: async (req, res) => {
      let releaseSubscription = null;
      let keepAliveId = null;
      let presenceRegistered = false;
      let viewerContext = null;

      try {
        const token = getTokenFromRequest(req);

        if (!token) {
          return res.status(401).json({
            message: "No token provided",
          });
        }

        const authUser = verifyAuthToken(token);
        viewerContext = await getAccessibleGroupContexts(authUser);

        const accessibleScopeIds = viewerContext.groupContexts.map((item) =>
          normalizeString(item?.scope?._id)
        );
        const accessibleScopeSet = new Set(accessibleScopeIds);
        const currentEmployeeId = normalizeString(viewerContext.viewer.employee?._id);

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders?.();

        sendSseEvent(res, "connected", {
          message: "Chat stream connected",
          timestamp: new Date().toISOString(),
        });

        registerViewerPresence(viewerContext.viewer, accessibleScopeIds);
        presenceRegistered = true;

        releaseSubscription = subscribeChatEvents((event) => {
          const eventScopeIds = Array.isArray(event?.scopeIds)
            ? event.scopeIds.map((item) => normalizeString(item))
            : [];
          const isAdminViewer = viewerContext.viewer.viewerRole === "admin";
          const hasScopeAccess =
            isAdminViewer ||
            eventScopeIds.some((scopeId) => accessibleScopeSet.has(scopeId));
          const isMentionTarget =
            currentEmployeeId &&
            Array.isArray(event?.mentionEmployeeIds) &&
            event.mentionEmployeeIds.some(
              (employeeId) => normalizeString(employeeId) === currentEmployeeId
            );

          if (!hasScopeAccess && !isMentionTarget) {
            return;
          }

          sendSseEvent(res, "chat-event", event);
        });

        keepAliveId = setInterval(() => {
          sendSseEvent(res, "ping", {
            timestamp: new Date().toISOString(),
          });
        }, 25000);

        req.on("close", () => {
          if (keepAliveId) clearInterval(keepAliveId);
          if (releaseSubscription) releaseSubscription();
          if (presenceRegistered) {
            unregisterViewerPresence(viewerContext.viewer, accessibleScopeIds);
          }
        });

        return undefined;
      } catch (err) {
        if (keepAliveId) clearInterval(keepAliveId);
        if (releaseSubscription) releaseSubscription();
        if (presenceRegistered && viewerContext) {
          const scopeIds = viewerContext.groupContexts.map((item) =>
            normalizeString(item?.scope?._id)
          );
          unregisterViewerPresence(viewerContext.viewer, scopeIds);
        }

        console.error("CHAT STREAM ERROR:", err);

        if (!res.headersSent) {
          return res.status(getStatusCode(err)).json({
            message: err.message || "Failed to open chat stream",
          });
        }

        sendSseEvent(res, "error", {
          message: err.message || "Failed to open chat stream",
        });
        res.end();
        return undefined;
      }
    },
  };
};

module.exports = createChatController;
