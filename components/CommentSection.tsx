/**
 * Comment Section Component
 *
 * Displays comments on a post with threading support.
 * Features:
 * - View comments with replies
 * - Add new comments
 * - Reply to comments
 * - Edit/delete own comments
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { Colors } from '@/constants/Colors';
import {
  useComments,
  useAddComment,
  useEditComment,
  useDeleteComment,
} from '@/hooks/useSocial';
import { useAppStore } from '@/stores/useAppStore';
import type { PostCommentWithUser } from '@/types/database';

interface CommentSectionProps {
  postId: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  commentCount: number;
}

export function CommentSection({
  postId,
  isExpanded,
  onToggleExpand,
  commentCount,
}: CommentSectionProps) {
  const { data: comments, isLoading } = useComments(postId);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const addComment = useAddComment();
  const editComment = useEditComment();
  const deleteComment = useDeleteComment();
  const userId = useAppStore((state) => state.userId);

  const handleSubmitComment = useCallback(async () => {
    if (!newComment.trim()) return;

    try {
      await addComment.mutateAsync({
        postId,
        content: newComment.trim(),
        parentCommentId: replyingTo || undefined,
      });
      setNewComment('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  }, [newComment, postId, replyingTo, addComment]);

  const handleEditComment = useCallback(async (commentId: string) => {
    if (!editText.trim()) return;

    try {
      await editComment.mutateAsync({
        commentId,
        postId,
        content: editText.trim(),
      });
      setEditingComment(null);
      setEditText('');
    } catch (error) {
      console.error('Failed to edit comment:', error);
    }
  }, [editText, postId, editComment]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    try {
      await deleteComment.mutateAsync({ commentId, postId });
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  }, [postId, deleteComment]);

  const startEditing = useCallback((comment: PostCommentWithUser) => {
    setEditingComment(comment.id);
    setEditText(comment.content);
  }, []);

  // Toggle button when not expanded
  if (!isExpanded) {
    return (
      <TouchableOpacity
        onPress={onToggleExpand}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 8,
        }}
      >
        <Ionicons name="chatbubble-outline" size={16} color={Colors.graphite[400]} />
        <Text style={{ marginLeft: 6, fontSize: 14, color: Colors.graphite[400] }}>
          {commentCount > 0 ? `View ${commentCount} comment${commentCount > 1 ? 's' : ''}` : 'Add a comment'}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ marginTop: 12 }}
    >
      {/* Header */}
      <TouchableOpacity
        onPress={onToggleExpand}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: Colors.glass.white[10],
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.graphite[100] }}>
          Comments ({commentCount})
        </Text>
        <Ionicons name="chevron-up" size={20} color={Colors.graphite[400]} />
      </TouchableOpacity>

      {/* Comments List */}
      {isLoading ? (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={Colors.signal[500]} />
        </View>
      ) : comments && comments.length > 0 ? (
        <View style={{ marginTop: 12 }}>
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              userId={userId}
              onReply={() => setReplyingTo(comment.id)}
              onEdit={() => startEditing(comment)}
              onDelete={() => handleDeleteComment(comment.id)}
              isEditing={editingComment === comment.id}
              editText={editText}
              onEditTextChange={setEditText}
              onSaveEdit={() => handleEditComment(comment.id)}
              onCancelEdit={() => {
                setEditingComment(null);
                setEditText('');
              }}
              depth={0}
            />
          ))}
        </View>
      ) : (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <Text style={{ color: Colors.graphite[400], fontSize: 14 }}>
            No comments yet. Be the first to comment!
          </Text>
        </View>
      )}

      {/* Reply indicator */}
      {replyingTo && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 8,
            paddingHorizontal: 12,
            marginTop: 8,
            borderRadius: 8,
            backgroundColor: Colors.glass.blue[10],
          }}
        >
          <Text style={{ fontSize: 12, color: Colors.signal[400] }}>
            Replying to comment
          </Text>
          <TouchableOpacity onPress={() => setReplyingTo(null)}>
            <Ionicons name="close" size={16} color={Colors.signal[400]} />
          </TouchableOpacity>
        </View>
      )}

      {/* New Comment Input */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          marginTop: 12,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: Colors.glass.white[10],
        }}
      >
        <TextInput
          value={newComment}
          onChangeText={setNewComment}
          placeholder={replyingTo ? 'Write a reply...' : 'Add a comment...'}
          placeholderTextColor={Colors.graphite[500]}
          multiline
          style={{
            flex: 1,
            maxHeight: 100,
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 20,
            backgroundColor: Colors.glass.white[5],
            color: Colors.graphite[100],
            fontSize: 14,
          }}
        />
        <TouchableOpacity
          onPress={handleSubmitComment}
          disabled={!newComment.trim() || addComment.isPending}
          style={{
            marginLeft: 8,
            padding: 10,
            borderRadius: 20,
            backgroundColor: newComment.trim() ? Colors.signal[500] : Colors.glass.white[10],
          }}
        >
          {addComment.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons
              name="send"
              size={18}
              color={newComment.trim() ? '#fff' : Colors.graphite[500]}
            />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * Individual Comment Item with threading support
 */
interface CommentItemProps {
  comment: PostCommentWithUser;
  userId: string | null;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isEditing: boolean;
  editText: string;
  onEditTextChange: (text: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  depth: number;
}

function CommentItem({
  comment,
  userId,
  onReply,
  onEdit,
  onDelete,
  isEditing,
  editText,
  onEditTextChange,
  onSaveEdit,
  onCancelEdit,
  depth,
}: CommentItemProps) {
  const isOwn = userId === comment.user_id;
  const displayName = comment.user?.display_name || comment.user?.email?.split('@')[0] || 'User';
  const timeAgo = getTimeAgo(new Date(comment.created_at));

  return (
    <View style={{ marginLeft: depth > 0 ? 24 : 0 }}>
      <View
        style={{
          paddingVertical: 10,
          borderLeftWidth: depth > 0 ? 2 : 0,
          borderLeftColor: Colors.glass.white[10],
          paddingLeft: depth > 0 ? 12 : 0,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          {/* Avatar placeholder */}
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: Colors.signal[600],
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 8,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>

          <Text style={{ fontWeight: '600', color: Colors.graphite[100], fontSize: 13 }}>
            {displayName}
          </Text>
          <Text style={{ marginLeft: 8, fontSize: 12, color: Colors.graphite[500] }}>
            {timeAgo}
          </Text>
          {comment.is_edited && (
            <Text style={{ marginLeft: 4, fontSize: 11, color: Colors.graphite[500], fontStyle: 'italic' }}>
              (edited)
            </Text>
          )}
        </View>

        {/* Content */}
        {isEditing ? (
          <View style={{ marginTop: 4 }}>
            <TextInput
              value={editText}
              onChangeText={onEditTextChange}
              multiline
              style={{
                padding: 10,
                borderRadius: 8,
                backgroundColor: Colors.glass.white[5],
                color: Colors.graphite[100],
                fontSize: 14,
              }}
            />
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              <TouchableOpacity
                onPress={onSaveEdit}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 6,
                  backgroundColor: Colors.signal[500],
                  marginRight: 8,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onCancelEdit}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 6,
                  backgroundColor: Colors.glass.white[10],
                }}
              >
                <Text style={{ color: Colors.graphite[300], fontSize: 12 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={{ color: Colors.graphite[200], fontSize: 14, lineHeight: 20 }}>
            {comment.content}
          </Text>
        )}

        {/* Actions */}
        {!isEditing && (
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <TouchableOpacity
              onPress={onReply}
              style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}
            >
              <Ionicons name="arrow-undo-outline" size={14} color={Colors.graphite[400]} />
              <Text style={{ marginLeft: 4, fontSize: 12, color: Colors.graphite[400] }}>
                Reply
              </Text>
            </TouchableOpacity>

            {isOwn && (
              <>
                <TouchableOpacity
                  onPress={onEdit}
                  style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}
                >
                  <Ionicons name="pencil-outline" size={14} color={Colors.graphite[400]} />
                  <Text style={{ marginLeft: 4, fontSize: 12, color: Colors.graphite[400] }}>
                    Edit
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onDelete}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <Ionicons name="trash-outline" size={14} color={Colors.regression[400]} />
                  <Text style={{ marginLeft: 4, fontSize: 12, color: Colors.regression[400] }}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <View style={{ marginTop: 4 }}>
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              userId={userId}
              onReply={onReply}
              onEdit={() => {}}
              onDelete={() => {}}
              isEditing={false}
              editText=""
              onEditTextChange={() => {}}
              onSaveEdit={() => {}}
              onCancelEdit={() => {}}
              depth={depth + 1}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * Format time ago string
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
