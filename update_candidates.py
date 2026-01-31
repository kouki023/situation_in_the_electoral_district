#!/usr/bin/env python3
"""
candidates.json 更新スクリプト

Google Apps Script APIから候補者データを取得し、
candidates.json ファイルを更新するプログラムです。
"""

import json
import requests
from pathlib import Path


# Google Apps Script API のエンドポイント
API_URL = "https://script.google.com/macros/s/AKfycby6lGMlTJJRCGdS-aLn9fvGit007kYTcADgdRELnjFT6sfikmbKrXANHwv109bLZNG0OA/exec"

# 更新対象のJSONファイルパス（スクリプトと同じディレクトリにある candidates.json）
CANDIDATES_FILE = Path(__file__).parent / "candidates.json"


def fetch_candidates_from_api() -> dict:
    """
    Google Apps Script APIから候補者データを取得する
    
    Returns:
        dict: APIから取得した候補者データ
        
    Raises:
        requests.RequestException: API通信エラー
        json.JSONDecodeError: JSONパースエラー
        ValueError: レスポンスがJSON形式でない場合
    """
    print(f"APIからデータを取得中: {API_URL}")
    
    # GASのAPIはリダイレクトを使用するため、allow_redirects=True が必要
    response = requests.get(API_URL, allow_redirects=True, timeout=30)
    response.raise_for_status()
    
    # Content-Typeを確認
    content_type = response.headers.get('content-type', '')
    print(f"Content-Type: {content_type}")
    
    # JSONでない場合はエラー内容を表示
    if 'application/json' not in content_type and 'text/json' not in content_type:
        print(f"警告: レスポンスがJSON形式ではありません")
        print(f"レスポンス内容（先頭500文字）: {response.text[:500]}")
        
        # それでもJSONとしてパースを試みる
        try:
            data = response.json()
        except json.JSONDecodeError:
            raise ValueError(
                f"APIからのレスポンスがJSON形式ではありません。\n"
                f"Google Apps Scriptのデプロイ設定を確認してください。\n"
                f"Content-Type: {content_type}"
            )
    else:
        data = response.json()
    
    print(f"データ取得成功: {len(data)} 件の選挙区データ")
    
    return data


def load_current_candidates() -> dict:
    """
    現在の candidates.json ファイルを読み込む
    
    Returns:
        dict: 現在の候補者データ（ファイルが存在しない場合は空の辞書）
    """
    if CANDIDATES_FILE.exists():
        with open(CANDIDATES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_candidates(data: dict) -> None:
    """
    候補者データを candidates.json に保存する
    
    Args:
        data: 保存する候補者データ
    """
    with open(CANDIDATES_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    print(f"データを保存しました: {CANDIDATES_FILE}")


def update_candidates() -> bool:
    """
    APIから候補者データを取得し、candidates.json を更新する
    
    Returns:
        bool: 更新が成功した場合は True
    """
    try:
        # APIからデータを取得
        new_data = fetch_candidates_from_api()
        
        # 現在のデータを読み込み（バックアップ用）
        current_data = load_current_candidates()
        
        # 変更点を表示
        current_keys = set(current_data.keys())
        new_keys = set(new_data.keys())
        
        added = new_keys - current_keys
        removed = current_keys - new_keys
        
        if added:
            print(f"追加された選挙区: {', '.join(sorted(added))}")
        if removed:
            print(f"削除された選挙区: {', '.join(sorted(removed))}")
        
        # データを保存
        save_candidates(new_data)
        
        print("候補者データの更新が完了しました。")
        return True
        
    except requests.RequestException as e:
        print(f"API通信エラー: {e}")
        return False
    except json.JSONDecodeError as e:
        print(f"JSONパースエラー: {e}")
        return False
    except ValueError as e:
        print(f"データ形式エラー: {e}")
        return False
    except Exception as e:
        print(f"予期しないエラー: {e}")
        return False


if __name__ == "__main__":
    print("=" * 50)
    print("候補者データ更新スクリプト")
    print("=" * 50)
    
    success = update_candidates()
    
    if success:
        print("\n✅ 更新完了")
    else:
        print("\n❌ 更新失敗")
        exit(1)
