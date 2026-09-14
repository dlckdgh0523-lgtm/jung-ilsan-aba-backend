import { Injectable } from '@nestjs/common';
import type { BlogRssItem, ParsedPost, PostTransformer } from './blog-sync.types';

/**
 * v1: import posts verbatim. This class exists only as the seam where a future
 * rewriting step (tone, summary, …) would plug in — swap the POST_TRANSFORMER
 * provider, nothing else changes.
 */
@Injectable()
export class PassthroughPostTransformer implements PostTransformer {
  transform(post: ParsedPost, _item: BlogRssItem): ParsedPost {
    return post;
  }
}
