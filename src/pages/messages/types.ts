export interface Conversation {
  conversation_id: string;
  message_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
  sender_name: string;
  sender_avatar: string;
  receiver_name: string;
  receiver_avatar: string;
  match_id: string | null;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
  match_id: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
  attachment_duration?: number | null;
  reply_to_id?: string | null;
  reply_to_content?: string | null;
  reply_to_sender_name?: string | null;
  shared_content_type?: string | null;
  shared_content_id?: string | null;
  shared_content_meta?: any;
  voice_note_transcript?: string | null;
}

export interface Attachment {
  url: string;
  type: 'image' | 'file';
  fileName?: string;
}

export interface ReplyTo {
  id: string;
  content: string;
  senderName: string;
}

export interface OtherUser {
  id: string;
  name: string;
  avatar: string;
  role?: string;
}
