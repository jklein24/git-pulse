export const PULL_REQUESTS_PAGE_QUERY = `
  query($owner: String!, $name: String!, $cursor: String, $orderBy: IssueOrder!) {
    repository(owner: $owner, name: $name) {
      pullRequests(first: 100, after: $cursor, orderBy: $orderBy) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          databaseId
          number
          state
          createdAt
          updatedAt
        }
      }
    }
    rateLimit {
      cost
      remaining
      resetAt
    }
  }
`;

export const PULL_REQUEST_DETAILS_QUERY = `
  query($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on PullRequest {
          id
          databaseId
          number
          title
          state
          isDraft
          createdAt
          mergedAt
          closedAt
          additions
          deletions
          changedFiles
          url
          author {
            login
            ... on User {
              databaseId
              avatarUrl
            }
          }
          timelineItems(first: 1, itemTypes: [READY_FOR_REVIEW_EVENT]) {
            nodes {
              ... on ReadyForReviewEvent {
                createdAt
              }
            }
          }
          reviews(first: 50) {
            nodes {
              id
              databaseId
              state
              submittedAt
              author {
                login
                ... on User {
                  databaseId
                  avatarUrl
                }
              }
            }
          }
          files(first: 100) {
            totalCount
            nodes {
              path
              additions
              deletions
              changeType
            }
          }
          updatedAt
      }
    }
    rateLimit {
      cost
      remaining
      resetAt
    }
  }
`;
