const { EventEmitter } = require("events");
const fs = require("fs/promises");
const path = require("path");
const { Types } = require("mongoose");
const ChatGroup = require("../models/ChatGroup");
const ChatMessage = require("../models/ChatMessage");
const Employee = require("../models/Employee");
const User = require("../models/User");

const normalizeString = (value) => String(value || "").trim();
const normalizeLower = (value) => normalizeString(value).toLowerCase();
const normalizeId = (value) => normalizeString(value?._id || value);
const normalizeIdList = (value) => {
  const rawRows = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set();

  return rawRows
    .map((item) => normalizeId(item))
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
};
const normalizeTextList = (value) =>
  (Array.isArray(value) ? value : value ? [value] : [])
    .map((item) => normalizeString(item))
    .filter(Boolean);
const escapeRegex = (value) =>
  normalizeString(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const buildViewerKey = (viewerRole, viewerId) => `${viewerRole}:${viewerId}`;
const uploadDir = path.join(__dirname, "..", "uploads");

const formatEmployeeDisplayLabel = (employee) => {
  const employeeCode = normalizeString(employee?.employeeCode);
  const employeeName = normalizeString(employee?.employeeName);

  if (employeeCode && employeeName) {
    return `${employeeCode} - ${employeeName}`;
  }

  return employeeCode || employeeName;
};

const buildEmployeeMatchTokens = (employee) => {
  const employeeCode = normalizeLower(employee?.employeeCode);
  const employeeName = normalizeLower(employee?.employeeName);
  const displayLabel = normalizeLower(formatEmployeeDisplayLabel(employee));

  return new Set([employeeCode, employeeName, displayLabel].filter(Boolean));
};

const areIdListsEqual = (left = [], right = []) => {
  if (left.length !== right.length) return false;

  return left.every((item, index) => String(item) === String(right[index]));
};

const sortByLabel = (left, right) =>
  String(left || "").localeCompare(String(right || ""), undefined, {
    sensitivity: "base",
  });

const buildActorName = (viewer) => {
  if (viewer.viewerRole === "employee") {
    return normalizeString(viewer.employee?.employeeName) || "Employee";
  }

  return normalizeString(viewer.userAccount?.name || viewer.user?.name) || "Admin";
};

const buildSearchText = ({ message, senderName, mentionNames, attachmentOriginalName }) =>
  [
    message,
    senderName,
    attachmentOriginalName,
    ...(Array.isArray(mentionNames) ? mentionNames : []),
  ]
    .map((item) => normalizeString(item))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const isImageMimeType = (mimeType) => normalizeLower(mimeType).startsWith("image/");

const getMessageAttachmentDetails = (messageRow) => {
  const attachmentFileName = normalizeString(
    messageRow?.attachmentFileName || messageRow?.imageFileName
  );
  const attachmentOriginalName = normalizeString(
    messageRow?.attachmentOriginalName || messageRow?.imageOriginalName
  );
  const attachmentMimeType = normalizeString(
    messageRow?.attachmentMimeType || messageRow?.imageMimeType
  );
  const attachmentSize = Number(messageRow?.attachmentSize) || 0;

  if (!attachmentFileName) {
    return null;
  }

  return {
    fileName: attachmentFileName,
    originalName: attachmentOriginalName,
    mimeType: attachmentMimeType,
    size: attachmentSize,
    isImage: isImageMimeType(attachmentMimeType),
    url: `/uploads/${attachmentFileName}`,
  };
};

const buildAttachmentSummaryText = (attachment) => {
  const attachmentLabel = attachment?.isImage ? "Image shared" : "File shared";
  const attachmentName = normalizeString(attachment?.originalName);

  return attachmentName ? `${attachmentLabel}: ${attachmentName}` : attachmentLabel;
};

const deleteChatAttachmentFile = async (fileName) => {
  const normalizedFileName = normalizeString(fileName);
  if (!normalizedFileName) return;

  try {
    await fs.unlink(path.join(uploadDir, normalizedFileName));
  } catch (err) {
    if (err?.code !== "ENOENT") {
      console.error("CHAT ATTACHMENT DELETE ERROR:", err);
    }
  }
};

const getReadState = (group, viewer) =>
  (Array.isArray(group?.readStates) ? group.readStates : []).find(
    (state) =>
      normalizeString(state?.viewerRole) === viewer.viewerRole &&
      normalizeString(state?.viewerId) === viewer.viewerId
  ) || null;

const isMessageFromViewer = (messageRow, viewer) =>
  normalizeString(messageRow?.senderRole) === viewer.viewerRole &&
  normalizeString(messageRow?.senderId) === viewer.viewerId;

const applyReadStateUpdate = (group, viewer, timestamp = new Date()) => {
  if (!Array.isArray(group.readStates)) {
    group.readStates = [];
  }

  const existingState = getReadState(group, viewer);

  if (existingState) {
    existingState.lastReadAt = timestamp;
    return;
  }

  group.readStates.push({
    viewerRole: viewer.viewerRole,
    viewerId: viewer.viewerId,
    lastReadAt: timestamp,
  });
};

const normalizeMentionIds = (value) => {
  const rawRows = Array.isArray(value) ? value : value ? [value] : [];
  const uniqueIds = [];
  const seen = new Set();

  rawRows
    .map((item) => normalizeId(item))
    .filter((item) => Types.ObjectId.isValid(item))
    .forEach((item) => {
      if (seen.has(item)) return;
      seen.add(item);
      uniqueIds.push(item);
    });

  return uniqueIds;
};

const buildMessageScopeId = (messageRow) =>
  normalizeId(messageRow?.departmentId || messageRow?.siteId);

const buildGroupScopeId = (groupRow) =>
  normalizeId(groupRow?.departmentId || groupRow?.siteId);

const createChatModuleService = ({
  chatType,
  emptyScopeLabel,
  emptyChatLabel,
  employeeScopeField,
  viewerEmployeeProjection,
  getAllActiveScopes,
  getScopeOwnerNames,
  getScopeSearchTerms,
  formatScopeDisplayName,
  formatGroupName,
  buildScopeSummary,
}) => {
  const normalizedChatType = normalizeLower(chatType) === "department" ? "department" : "site";
  const chatEvents = new EventEmitter();
  chatEvents.setMaxListeners(0);
  const activeConnections = new Map();

  // Legacy chat groups may not have chatType populated yet. Keep them discoverable
  // so the first sync can backfill the record instead of failing on duplicate keys.
  const buildChatTypeQuery = () => ({
    $or: [
      { chatType: normalizedChatType },
      { chatType: { $exists: false } },
      { chatType: null },
      { chatType: "" },
    ],
  });
  const buildScopeGroupQuery = (scopeId) => ({
    $or: [{ siteId: scopeId }, { departmentId: scopeId }],
  });

  const getActiveEmployeeConnection = (employeeId) =>
    activeConnections.get(buildViewerKey("employee", normalizeId(employeeId))) || 0;

  const isEmployeeOnline = (employeeId) => getActiveEmployeeConnection(employeeId) > 0;

  const registerViewerPresence = (viewer, scopeIds = []) => {
    const viewerKey = buildViewerKey(viewer.viewerRole, viewer.viewerId);
    const nextCount = (activeConnections.get(viewerKey) || 0) + 1;

    activeConnections.set(viewerKey, nextCount);

    chatEvents.emit("chat-event", {
      type: "presence",
      chatType: normalizedChatType,
      scopeIds,
      viewerRole: viewer.viewerRole,
      viewerId: viewer.viewerId,
      online: true,
    });
  };

  const unregisterViewerPresence = (viewer, scopeIds = []) => {
    const viewerKey = buildViewerKey(viewer.viewerRole, viewer.viewerId);
    const currentCount = activeConnections.get(viewerKey) || 0;
    const nextCount = Math.max(currentCount - 1, 0);

    if (nextCount > 0) {
      activeConnections.set(viewerKey, nextCount);
      return;
    }

    activeConnections.delete(viewerKey);

    chatEvents.emit("chat-event", {
      type: "presence",
      chatType: normalizedChatType,
      scopeIds,
      viewerRole: viewer.viewerRole,
      viewerId: viewer.viewerId,
      online: false,
    });
  };

  const subscribeChatEvents = (listener) => {
    chatEvents.on("chat-event", listener);
    return () => {
      chatEvents.off("chat-event", listener);
    };
  };

  const emitChatEvent = (payload) => {
    chatEvents.emit("chat-event", {
      ...payload,
      chatType: normalizedChatType,
      emittedAt: new Date().toISOString(),
    });
  };

  const buildMemberSummary = (employee) => ({
    _id: normalizeId(employee),
    employeeCode: normalizeString(employee?.employeeCode),
    employeeName: normalizeString(employee?.employeeName),
    email: normalizeString(employee?.email),
    isOnline: isEmployeeOnline(employee?._id),
    displayName: formatEmployeeDisplayLabel(employee),
  });

  const serializeMessage = (messageRow, viewer) => {
    const attachment = getMessageAttachmentDetails(messageRow);
    const mentionEmployees = Array.isArray(messageRow?.mentions)
      ? messageRow.mentions.map((employee) => buildMemberSummary(employee))
      : [];
    const createdAt =
      messageRow?.createdAt instanceof Date
        ? messageRow.createdAt
        : messageRow?.createdAt
        ? new Date(messageRow.createdAt)
        : null;
    const updatedAt =
      messageRow?.updatedAt instanceof Date
        ? messageRow.updatedAt
        : messageRow?.updatedAt
        ? new Date(messageRow.updatedAt)
        : null;

    return {
      _id: normalizeId(messageRow),
      groupId: normalizeId(messageRow?.groupId),
      chatType: normalizeLower(messageRow?.chatType) || normalizedChatType,
      scopeId: buildMessageScopeId(messageRow),
      senderRole: normalizeString(messageRow?.senderRole),
      senderId: normalizeString(messageRow?.senderId),
      senderName: normalizeString(messageRow?.senderName),
      message: normalizeString(messageRow?.message),
      attachment,
      image: attachment?.isImage ? attachment : null,
      mentionNames: Array.isArray(messageRow?.mentionNames) ? messageRow.mentionNames : [],
      mentionEmployees,
      isOwnMessage: isMessageFromViewer(messageRow, viewer),
      isEdited:
        Boolean(createdAt && updatedAt) && updatedAt.getTime() > createdAt.getTime() + 1000,
      createdAt,
      updatedAt,
    };
  };

  const buildPreviewText = (message, attachment = null) => {
    const normalizedMessage = normalizeString(message);

    if (!normalizedMessage) {
      return attachment ? buildAttachmentSummaryText(attachment) : "";
    }

    return normalizedMessage.length > 140
      ? `${normalizedMessage.slice(0, 137)}...`
      : normalizedMessage;
  };

  const resolveGroupMentions = async (groupContext, mentionIds) => {
    const allowedMemberIds = new Set(
      groupContext.members.map((member) => normalizeId(member)).filter(Boolean)
    );
    const validMentionIds = normalizeMentionIds(mentionIds).filter((mentionId) =>
      allowedMemberIds.has(mentionId)
    );
    const mentionEmployees = validMentionIds.length
      ? await Employee.find(
          {
            _id: { $in: validMentionIds },
            isActive: true,
          },
          "employeeCode employeeName email"
        ).lean()
      : [];
    const mentionEmployeeMap = new Map(
      mentionEmployees.map((employee) => [normalizeId(employee), employee])
    );
    const orderedMentionEmployees = validMentionIds
      .map((mentionId) => mentionEmployeeMap.get(normalizeId(mentionId)))
      .filter(Boolean);
    const mentionNames = orderedMentionEmployees
      .map((employee) => normalizeString(employee?.employeeName))
      .filter(Boolean);

    return {
      orderedMentionEmployees,
      mentionNames,
    };
  };

  const syncGroupLastMessageSummary = async (group) => {
    const latestMessage = await ChatMessage.findOne({ groupId: group._id })
      .sort({ createdAt: -1, _id: -1 })
      .lean();

    if (!latestMessage) {
      group.lastMessageAt = null;
      group.lastMessagePreview = "";
    } else {
      group.lastMessageAt = latestMessage.createdAt || null;
      group.lastMessagePreview = buildPreviewText(
        latestMessage.message,
        getMessageAttachmentDetails(latestMessage)
      );
    }

    await group.save();
  };

  const countUnreadMessages = async (group, viewer, lastReadAt) => {
    const query = {
      groupId: group._id,
      $or: [
        { senderRole: { $ne: viewer.viewerRole } },
        { senderId: { $ne: viewer.viewerId } },
      ],
    };

    if (lastReadAt) {
      query.createdAt = { $gt: lastReadAt };
    }

    return ChatMessage.countDocuments(query);
  };

  const countUnreadMentions = async (group, viewer, lastReadAt) => {
    if (viewer.viewerRole !== "employee" || !viewer.employee?._id) {
      return 0;
    }

    const query = {
      groupId: group._id,
      mentions: viewer.employee._id,
      $or: [
        { senderRole: { $ne: viewer.viewerRole } },
        { senderId: { $ne: viewer.viewerId } },
      ],
    };

    if (lastReadAt) {
      query.createdAt = { $gt: lastReadAt };
    }

    return ChatMessage.countDocuments(query);
  };

  const buildGroupSummary = async (context, groupContext) => {
    const { viewer } = context;
    const { group, scope, members } = groupContext;
    const readState = getReadState(group, viewer);
    const lastReadAt = readState?.lastReadAt || null;
    const [unreadCount, unreadMentionCount] = await Promise.all([
      countUnreadMessages(group, viewer, lastReadAt),
      countUnreadMentions(group, viewer, lastReadAt),
    ]);

    return {
      _id: normalizeId(group),
      chatType: normalizedChatType,
      name: normalizeString(group?.groupName || group?.name),
      groupName: normalizeString(group?.groupName || group?.name),
      scopeId: normalizeId(scope),
      scopeName: normalizeString(scope?.name),
      scopeDisplayName: formatScopeDisplayName(scope),
      lastMessageAt: group?.lastMessageAt || null,
      lastMessagePreview: normalizeString(group?.lastMessagePreview),
      unreadCount,
      unreadMentionCount,
      lastReadAt,
      memberCount: members.length,
      members: members.map((member) => buildMemberSummary(member)),
      ...buildScopeSummary(scope),
    };
  };

  const getEmployeeViewer = async (user) => {
    const employee = await Employee.findOne(
      {
        _id: user.id,
        isActive: true,
      },
      viewerEmployeeProjection
    ).lean();

    if (!employee) {
      const error = new Error("Employee account not found");
      error.status = 404;
      throw error;
    }

    return employee;
  };

  const getAdminViewer = async (user) => {
    const userAccount = await User.findById(user.id).lean();

    if (!userAccount) {
      const error = new Error("Admin account not found");
      error.status = 404;
      throw error;
    }

    return userAccount;
  };

  const buildViewerContext = async (user) => {
    const viewerRole = normalizeLower(user?.role);

    if (viewerRole !== "admin" && viewerRole !== "employee") {
      const error = new Error("Chat is available only for admin and employee users");
      error.status = 403;
      throw error;
    }

    const [allScopes, employee, userAccount] = await Promise.all([
      getAllActiveScopes(),
      viewerRole === "employee" ? getEmployeeViewer(user) : Promise.resolve(null),
      viewerRole === "admin" ? getAdminViewer(user) : Promise.resolve(null),
    ]);

    const accessibleScopeMap = new Map();

    if (viewerRole === "admin") {
      allScopes.forEach((scope) => {
        accessibleScopeMap.set(normalizeId(scope), scope);
      });
    } else {
      const employeeMatchTokens = buildEmployeeMatchTokens(employee);
      const assignedScopeIds = new Set(normalizeIdList(employee?.[employeeScopeField]));

      allScopes.forEach((scope) => {
        const scopeId = normalizeId(scope);
        const scopeOwnerNames = normalizeTextList(getScopeOwnerNames(scope));
        const matchesScopeOwnership = scopeOwnerNames.some((name) =>
          employeeMatchTokens.has(normalizeLower(name))
        );

        if (assignedScopeIds.has(scopeId) || matchesScopeOwnership) {
          accessibleScopeMap.set(scopeId, scope);
        }
      });
    }

    const accessibleScopes = [...accessibleScopeMap.values()].sort((left, right) =>
      sortByLabel(formatScopeDisplayName(left), formatScopeDisplayName(right))
    );

    return {
      viewer: {
        viewerRole,
        viewerId: normalizeString(user?.id),
        employee,
        userAccount,
        user,
        displayName: buildActorName({ viewerRole, employee, userAccount, user }),
      },
      accessibleScopes,
    };
  };

  const syncChatGroupsForScopes = async (scopes = []) => {
    const scopeIds = scopes.map((scope) => normalizeId(scope)).filter(Boolean);

    if (!scopeIds.length) {
      return [];
    }

    const [existingGroups, activeEmployees] = await Promise.all([
      ChatGroup.find({
        $and: [
          buildChatTypeQuery(),
          {
            $or: [{ siteId: { $in: scopeIds } }, { departmentId: { $in: scopeIds } }],
          },
        ],
      }),
      Employee.find(
        {
          isActive: true,
        },
        viewerEmployeeProjection
      )
        .sort({ employeeName: 1 })
        .lean(),
    ]);

    const existingGroupMap = new Map(
      existingGroups.map((group) => [buildGroupScopeId(group), group])
    );
    const scopeIdSet = new Set(scopeIds);
    const memberMap = new Map(scopeIds.map((scopeId) => [scopeId, []]));
    const memberSeenMap = new Map(scopeIds.map((scopeId) => [scopeId, new Set()]));
    const scopeOwnerTokenMap = new Map(
      scopes.map((scope) => [
        normalizeId(scope),
        new Set(
          normalizeTextList(getScopeOwnerNames(scope))
            .map((item) => normalizeLower(item))
            .filter(Boolean)
        ),
      ])
    );

    const addMemberToScope = (scopeId, employee) => {
      if (!scopeIdSet.has(scopeId)) return;

      const memberId = normalizeId(employee);
      if (!memberId) return;

      const seenIds = memberSeenMap.get(scopeId);
      if (!seenIds || seenIds.has(memberId)) return;

      seenIds.add(memberId);
      memberMap.get(scopeId)?.push(employee);
    };

    activeEmployees.forEach((employee) => {
      const employeeScopeIds = normalizeIdList(employee?.[employeeScopeField]);
      const employeeScopeIdSet = new Set(employeeScopeIds);
      const employeeMatchTokens = [...buildEmployeeMatchTokens(employee)];

      employeeScopeIds.forEach((scopeId) => {
        addMemberToScope(scopeId, employee);
      });

      scopeIds.forEach((scopeId) => {
        if (employeeScopeIdSet.has(scopeId)) return;

        const scopeOwnerTokens = scopeOwnerTokenMap.get(scopeId);
        if (!scopeOwnerTokens?.size) return;

        const matchesScopeOwnership = employeeMatchTokens.some((token) =>
          scopeOwnerTokens.has(token)
        );

        if (matchesScopeOwnership) {
          addMemberToScope(scopeId, employee);
        }
      });
    });

    const groupContexts = [];

    for (const scope of scopes) {
      const scopeId = normalizeId(scope);
      const members = [...(memberMap.get(scopeId) || [])].sort((left, right) =>
        sortByLabel(formatEmployeeDisplayLabel(left), formatEmployeeDisplayLabel(right))
      );
      const desiredMemberIds = members.map((member) => member._id);
      const desiredGroupName = formatGroupName(scope);
      let group = existingGroupMap.get(scopeId);

      if (!group) {
        try {
          group = await ChatGroup.create({
            chatType: normalizedChatType,
            siteId: scope._id,
            departmentId: scope._id,
            groupName: desiredGroupName,
            name: desiredGroupName,
            memberEmployeeIds: desiredMemberIds,
          });
        } catch (err) {
          if (err?.code === 11000) {
            group = await ChatGroup.findOne({
              $and: [
                buildChatTypeQuery(),
                buildScopeGroupQuery(scope._id),
              ],
            });
          } else {
            throw err;
          }
        }
      }

      if (!group) {
        const error = new Error(
          `Unable to resolve ${normalizeLower(emptyChatLabel)} group for ${formatScopeDisplayName(scope)}`
        );
        error.status = 500;
        throw error;
      }

      const currentMemberIds = Array.isArray(group?.memberEmployeeIds)
        ? group.memberEmployeeIds.map((item) => normalizeId(item))
        : [];
      const nextMemberIds = desiredMemberIds.map((item) => normalizeId(item));
      const requiresUpdate =
        normalizeLower(group?.chatType) !== normalizedChatType ||
        buildGroupScopeId(group) !== scopeId ||
        normalizeString(group?.groupName || group?.name) !== desiredGroupName ||
        !areIdListsEqual(currentMemberIds, nextMemberIds);

      if (requiresUpdate) {
        group.chatType = normalizedChatType;
        group.siteId = scope._id;
        group.departmentId = scope._id;
        group.groupName = desiredGroupName;
        group.name = desiredGroupName;
        group.memberEmployeeIds = desiredMemberIds;
        await group.save();
      }

      groupContexts.push({
        chatType: normalizedChatType,
        group,
        scope,
        members,
      });
    }

    return groupContexts.sort((left, right) =>
      sortByLabel(formatScopeDisplayName(left?.scope), formatScopeDisplayName(right?.scope))
    );
  };

  const getAccessibleGroupContexts = async (user) => {
    const context = await buildViewerContext(user);
    const groupContexts = await syncChatGroupsForScopes(context.accessibleScopes);

    return {
      ...context,
      groupContexts,
    };
  };

  const getGroupContextForViewer = async (user, groupId) => {
    const normalizedGroupId = normalizeId(groupId);

    if (!Types.ObjectId.isValid(normalizedGroupId)) {
      const error = new Error("Invalid chat group");
      error.status = 400;
      throw error;
    }

    const context = await getAccessibleGroupContexts(user);
    const groupContext = context.groupContexts.find(
      (item) => normalizeId(item?.group) === normalizedGroupId
    );

    if (!groupContext) {
      const error = new Error("Chat group not found or access denied");
      error.status = 404;
      throw error;
    }

    return {
      ...context,
      groupContext,
    };
  };

  const listAccessibleGroups = async (user, options = {}) => {
    const searchText = normalizeLower(options.search);
    const context = await getAccessibleGroupContexts(user);
    const filteredGroups = context.groupContexts.filter((item) => {
      if (!searchText) return true;

      const groupName = normalizeLower(item?.group?.groupName || item?.group?.name);
      const scopeSearchTerms = getScopeSearchTerms(item?.scope)
        .map((term) => normalizeLower(term))
        .filter(Boolean);

      return [groupName, ...scopeSearchTerms].some((term) => term.includes(searchText));
    });

    const groups = await Promise.all(
      filteredGroups.map((groupContext) => buildGroupSummary(context, groupContext))
    );

    return {
      viewer: {
        role: context.viewer.viewerRole,
        id: context.viewer.viewerId,
        name: context.viewer.displayName,
        employeeId: normalizeId(context.viewer.employee),
      },
      groups,
    };
  };

  const getGroupMessages = async (user, groupId, options = {}) => {
    const searchText = normalizeLower(options.search);
    const limit = Math.min(Math.max(Number(options.limit) || 100, 1), 300);
    const { viewer, groupContext } = await getGroupContextForViewer(user, groupId);

    const query = {
      groupId: groupContext.group._id,
    };

    if (searchText) {
      query.searchText = { $regex: escapeRegex(searchText), $options: "i" };
    }

    const rows = await ChatMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("mentions", "employeeCode employeeName email")
      .lean();

    const messages = rows.reverse().map((row) => serializeMessage(row, viewer));

    return {
      group: await buildGroupSummary(
        { viewer, accessibleScopes: [], groupContexts: [] },
        groupContext
      ),
      messages,
    };
  };

  const markGroupAsRead = async (user, groupId) => {
    const { viewer, groupContext } = await getGroupContextForViewer(user, groupId);
    const timestamp = new Date();

    applyReadStateUpdate(groupContext.group, viewer, timestamp);
    await groupContext.group.save();

    emitChatEvent({
      type: "read",
      scopeIds: [normalizeId(groupContext.scope)],
      groupId: normalizeId(groupContext.group),
      viewerRole: viewer.viewerRole,
      viewerId: viewer.viewerId,
    });

    return {
      message: "Chat group marked as read",
      groupId: normalizeId(groupContext.group),
      readAt: timestamp,
    };
  };

  const sendMessageToGroup = async (user, groupId, payload = {}) => {
    const message = normalizeString(payload.message);
    const attachmentFileName = normalizeString(payload.file?.filename);
    const attachmentOriginalName = normalizeString(payload.file?.originalname);
    const attachmentMimeType = normalizeString(payload.file?.mimetype);
    const attachmentSize = Number(payload.file?.size) || 0;
    const hasLegacyImageField = normalizeString(payload.file?.fieldname) === "image";
    const isImageAttachment = isImageMimeType(attachmentMimeType) || hasLegacyImageField;

    if (!message && !attachmentFileName) {
      const error = new Error("Message or attachment is required");
      error.status = 400;
      throw error;
    }

    const { viewer, groupContext } = await getGroupContextForViewer(user, groupId);
    const { orderedMentionEmployees, mentionNames } = await resolveGroupMentions(
      groupContext,
      payload.mentionIds
    );

    const chatMessage = await ChatMessage.create({
      groupId: groupContext.group._id,
      chatType: normalizedChatType,
      siteId: groupContext.scope._id,
      departmentId: groupContext.scope._id,
      senderRole: viewer.viewerRole,
      senderId: viewer.viewerId,
      senderName: viewer.displayName,
      message,
      attachmentFileName,
      attachmentOriginalName,
      attachmentMimeType,
      attachmentSize,
      imageFileName: isImageAttachment ? attachmentFileName : "",
      imageOriginalName: isImageAttachment ? attachmentOriginalName : "",
      imageMimeType: isImageAttachment ? attachmentMimeType : "",
      mentions: orderedMentionEmployees.map((employee) => employee._id),
      mentionNames,
      searchText: buildSearchText({
        message,
        senderName: viewer.displayName,
        mentionNames,
        attachmentOriginalName,
      }),
    });

    groupContext.group.lastMessageAt = chatMessage.createdAt;
    groupContext.group.lastMessagePreview = buildPreviewText(message, {
      originalName: attachmentOriginalName,
      mimeType: attachmentMimeType,
      isImage: isImageAttachment,
    });
    await groupContext.group.save();

    emitChatEvent({
      type: "message",
      scopeIds: [normalizeId(groupContext.scope)],
      groupId: normalizeId(groupContext.group),
      mentionEmployeeIds: orderedMentionEmployees.map((employee) => normalizeId(employee)),
      senderRole: viewer.viewerRole,
      senderId: viewer.viewerId,
    });

    const hydratedMessage = await ChatMessage.findById(chatMessage._id)
      .populate("mentions", "employeeCode employeeName email")
      .lean();

    return {
      message: "Chat message sent",
      chatMessage: serializeMessage(hydratedMessage, viewer),
    };
  };

  const getOwnedMessageContextForViewer = async (user, groupId, messageId) => {
    const normalizedMessageId = normalizeId(messageId);

    if (!Types.ObjectId.isValid(normalizedMessageId)) {
      const error = new Error("Invalid chat message");
      error.status = 400;
      throw error;
    }

    const context = await getGroupContextForViewer(user, groupId);
    const messageRow = await ChatMessage.findOne({
      _id: normalizedMessageId,
      groupId: context.groupContext.group._id,
    });

    if (!messageRow) {
      const error = new Error("Chat message not found");
      error.status = 404;
      throw error;
    }

    if (
      normalizeString(messageRow.senderRole) !== context.viewer.viewerRole ||
      normalizeString(messageRow.senderId) !== context.viewer.viewerId
    ) {
      const error = new Error("You can edit or delete only your own chat messages");
      error.status = 403;
      throw error;
    }

    return {
      ...context,
      messageRow,
    };
  };

  const updateGroupMessage = async (user, groupId, messageId, payload = {}) => {
    const nextMessage = normalizeString(payload.message);
    const { viewer, groupContext, messageRow } = await getOwnedMessageContextForViewer(
      user,
      groupId,
      messageId
    );

    const messageAttachment = getMessageAttachmentDetails(messageRow);

    if (!nextMessage && !messageAttachment?.fileName) {
      const error = new Error("Message or attachment is required");
      error.status = 400;
      throw error;
    }

    const { orderedMentionEmployees, mentionNames } = await resolveGroupMentions(
      groupContext,
      payload.mentionIds
    );

    messageRow.chatType = normalizedChatType;
    messageRow.message = nextMessage;
    messageRow.siteId = groupContext.scope._id;
    messageRow.departmentId = groupContext.scope._id;
    messageRow.mentions = orderedMentionEmployees.map((employee) => employee._id);
    messageRow.mentionNames = mentionNames;
    messageRow.searchText = buildSearchText({
      message: nextMessage,
      senderName: messageRow.senderName,
      mentionNames,
      attachmentOriginalName: messageAttachment?.originalName,
    });
    await messageRow.save();

    await syncGroupLastMessageSummary(groupContext.group);

    emitChatEvent({
      type: "message_updated",
      scopeIds: [normalizeId(groupContext.scope)],
      groupId: normalizeId(groupContext.group),
      messageId: normalizeId(messageRow),
      mentionEmployeeIds: orderedMentionEmployees.map((employee) => normalizeId(employee)),
      senderRole: viewer.viewerRole,
      senderId: viewer.viewerId,
    });

    const hydratedMessage = await ChatMessage.findById(messageRow._id)
      .populate("mentions", "employeeCode employeeName email")
      .lean();

    return {
      message: "Chat message updated",
      chatMessage: serializeMessage(hydratedMessage, viewer),
    };
  };

  const deleteGroupMessage = async (user, groupId, messageId) => {
    const { viewer, groupContext, messageRow } = await getOwnedMessageContextForViewer(
      user,
      groupId,
      messageId
    );

    const deletedMessageId = normalizeId(messageRow);
    const deletedAttachmentFileName = normalizeString(
      messageRow.attachmentFileName || messageRow.imageFileName
    );

    await ChatMessage.deleteOne({ _id: messageRow._id });
    await deleteChatAttachmentFile(deletedAttachmentFileName);
    await syncGroupLastMessageSummary(groupContext.group);

    emitChatEvent({
      type: "message_deleted",
      scopeIds: [normalizeId(groupContext.scope)],
      groupId: normalizeId(groupContext.group),
      messageId: deletedMessageId,
      senderRole: viewer.viewerRole,
      senderId: viewer.viewerId,
    });

    return {
      message: "Chat message deleted",
      deletedMessageId,
      groupId: normalizeId(groupContext.group),
    };
  };

  const getChatNotifications = async (user, options = {}) => {
    const limit = Math.min(Math.max(Number(options.limit) || 10, 1), 30);
    const context = await getAccessibleGroupContexts(user);
    const unreadGroupCounts = await Promise.all(
      context.groupContexts.map((groupContext) => buildGroupSummary(context, groupContext))
    );

    if (context.viewer.viewerRole !== "employee" || !context.viewer.employee?._id) {
      return {
        counts: {
          mentions: 0,
          unreadMessages: unreadGroupCounts.reduce(
            (total, group) => total + Number(group.unreadCount || 0),
            0
          ),
        },
        mentions: [],
      };
    }

    const groupIds = context.groupContexts.map((groupContext) => groupContext.group._id);

    if (!groupIds.length) {
      return {
        counts: {
          mentions: 0,
          unreadMessages: 0,
        },
        mentions: [],
      };
    }

    const readStateMap = new Map(
      context.groupContexts.map((groupContext) => {
        const state = getReadState(groupContext.group, context.viewer);
        return [normalizeId(groupContext.group), state?.lastReadAt || null];
      })
    );
    const groupMetaMap = new Map(
      context.groupContexts.map((groupContext) => [
        normalizeId(groupContext.group),
        {
          groupId: normalizeId(groupContext.group),
          chatType: normalizedChatType,
          groupName: normalizeString(groupContext.group?.groupName || groupContext.group?.name),
          scopeId: normalizeId(groupContext.scope),
          scopeName: normalizeString(groupContext.scope?.name),
          scopeDisplayName: formatScopeDisplayName(groupContext.scope),
          ...buildScopeSummary(groupContext.scope),
        },
      ])
    );

    const mentionRows = await ChatMessage.find({
      groupId: { $in: groupIds },
      mentions: context.viewer.employee._id,
      $or: [
        { senderRole: { $ne: context.viewer.viewerRole } },
        { senderId: { $ne: context.viewer.viewerId } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(limit * 5)
      .lean();

    const unreadMentions = mentionRows
      .filter((row) => {
        const lastReadAt = readStateMap.get(normalizeId(row.groupId));
        if (!lastReadAt) return true;
        return new Date(row.createdAt).getTime() > new Date(lastReadAt).getTime();
      })
      .slice(0, limit)
      .map((row) => {
        const groupMeta = groupMetaMap.get(normalizeId(row.groupId)) || {};
        const attachment = getMessageAttachmentDetails(row);

        return {
          _id: normalizeId(row),
          groupId: normalizeId(row.groupId),
          chatType: normalizeLower(row.chatType) || normalizedChatType,
          scopeId: buildMessageScopeId(row) || normalizeString(groupMeta.scopeId),
          senderId: normalizeString(row.senderId),
          senderRole: normalizeString(row.senderRole),
          senderName: normalizeString(row.senderName),
          message: normalizeString(row.message),
          attachment,
          image: attachment?.isImage ? attachment : null,
          mentionNames: Array.isArray(row.mentionNames) ? row.mentionNames : [],
          createdAt: row.createdAt || null,
          groupName: normalizeString(groupMeta.groupName) || emptyChatLabel,
          scopeName: normalizeString(groupMeta.scopeName) || emptyScopeLabel,
          scopeDisplayName: normalizeString(groupMeta.scopeDisplayName) || emptyChatLabel,
          ...groupMeta,
        };
      });

    return {
      counts: {
        mentions: unreadMentions.length,
        unreadMessages: unreadGroupCounts.reduce(
          (total, group) => total + Number(group.unreadCount || 0),
          0
        ),
      },
      mentions: unreadMentions,
    };
  };

  return {
    listAccessibleGroups,
    getGroupMessages,
    sendMessageToGroup,
    updateGroupMessage,
    deleteGroupMessage,
    markGroupAsRead,
    getChatNotifications,
    buildViewerContext,
    getAccessibleGroupContexts,
    subscribeChatEvents,
    emitChatEvent,
    registerViewerPresence,
    unregisterViewerPresence,
    buildViewerKey,
  };
};

module.exports = createChatModuleService;
