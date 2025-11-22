const LINE_API_BASE = "https://api.line.me/v2";
const LINE_API_DATA_BASE = "https://api-data.line.me/v2";

export interface LineBotInfo {
  userId: string;
  basicId: string;
  displayName: string;
  pictureUrl?: string;
  chatMode: string;
  markAsReadMode: string;
}

export interface LineRichMenu {
  richMenuId: string;
  size: {
    width: number;
    height: number;
  };
  selected: boolean;
  name: string;
  chatBarText: string;
  areas: Array<{
    bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    action: {
      type: string;
      uri?: string;
      data?: string;
      displayText?: string;
      text?: string;
    };
  }>;
}

export class LineClient {
  constructor(private accessToken: string) {}

  private async request<T>(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<T> {
    const url = `${LINE_API_BASE}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LINE API error (${response.status}): ${errorText}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  async getBotInfo(): Promise<LineBotInfo> {
    return this.request<LineBotInfo>("GET", "/bot/info");
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.getBotInfo();
      return true;
    } catch (error) {
      return false;
    }
  }

  async createRichMenu(richMenu: Omit<LineRichMenu, "richMenuId">): Promise<{ richMenuId: string }> {
    return this.request("POST", "/bot/richmenu", richMenu);
  }

  async getRichMenuList(): Promise<{ richmenus: LineRichMenu[] }> {
    return this.request("GET", "/bot/richmenu/list");
  }

  async getRichMenu(richMenuId: string): Promise<LineRichMenu> {
    return this.request("GET", `/bot/richmenu/${richMenuId}`);
  }

  async deleteRichMenu(richMenuId: string): Promise<void> {
    await this.request("DELETE", `/bot/richmenu/${richMenuId}`);
  }

  async setDefaultRichMenu(richMenuId: string): Promise<void> {
    await this.request("POST", `/bot/user/all/richmenu/${richMenuId}`);
  }

  async getDefaultRichMenu(): Promise<{ richMenuId: string }> {
    return this.request("GET", "/bot/user/all/richmenu");
  }

  async cancelDefaultRichMenu(): Promise<void> {
    await this.request("DELETE", "/bot/user/all/richmenu");
  }

  async linkRichMenuToUser(userId: string, richMenuId: string): Promise<void> {
    await this.request("POST", `/bot/user/${userId}/richmenu/${richMenuId}`);
  }

  async unlinkRichMenuFromUser(userId: string): Promise<void> {
    await this.request("DELETE", `/bot/user/${userId}/richmenu`);
  }

  async uploadRichMenuImage(richMenuId: string, imageBuffer: Buffer, contentType: string): Promise<void> {
    const url = `${LINE_API_DATA_BASE}/bot/richmenu/${richMenuId}/content`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Content-Type": contentType,
      },
      body: imageBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LINE API error (${response.status}): ${errorText}`);
    }
  }

  async replyMessage(replyToken: string, messages: any | any[]): Promise<void> {
    const messageArray = Array.isArray(messages) ? messages : [messages];
    await this.request("POST", "/bot/message/reply", {
      replyToken,
      messages: messageArray
    });
  }

  async pushMessage(userId: string, messages: any | any[]): Promise<void> {
    const messageArray = Array.isArray(messages) ? messages : [messages];
    await this.request("POST", "/bot/message/push", {
      to: userId,
      messages: messageArray
    });
  }
}
